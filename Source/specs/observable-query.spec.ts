// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import {
    ArcServer, CurrentValueSubject, Severity, currentServices, defineObservableQuery, exportClientManifest, serviceToken
} from '../src/index.js';
import type { ExecutionContext, ObservableObserver } from '../src/index.js';
import { shouldRejectWithError } from './shouldRejectWithError.js';

should();
const execution = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
    correlationId: crypto.randomUUID(), signal: new AbortController().signal,
    allowedSeverity: Severity.Warning, principal: undefined, tenantId: 'first', ...overrides
});

describe('observable query pipeline', () => {
    it('should return a current snapshot and close its scope on GET', async () => {
        const subject = new CurrentValueSubject<number[]>({ hasValue: true, value: [1, 2] });
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => subject
        })] });
        const response = await server.handle(new Request('http://localhost/api/numbers'));
        response?.status.should.equal(200);
        (await response!.json()).data.should.deep.equal([1, 2]);
        await server.dispose();
    });

    it('should report pending when a subject has not published a value', async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => new CurrentValueSubject<number[]>()
        })] });
        const response = await server.handle(new Request('http://localhost/api/numbers'));
        response?.status.should.equal(202);
        const result = await response!.json();
        should().equal(result.isReady, false);
        should().equal(result.hasExceptions, false);
        await server.dispose();
    });

    it('should wait for the first value and honor the bounded timeout', async () => {
        const subject = new CurrentValueSubject<number>();
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Number', schema: z.object({}), observe: () => subject
        })], development: true });
        const timeout = await server.handle(new Request('http://localhost/api/number?waitForFirstResult=true&waitForFirstResultTimeout=0.01'));
        timeout?.status.should.equal(408);
        (await timeout!.json()).hasExceptions.should.equal(true);
        const pending = server.handle(new Request('http://localhost/api/number?waitForFirstResult=true'));
        await new Promise(resolve => setTimeout(resolve, 10));
        subject.next(42);
        const response = await pending;
        response?.status.should.equal(200);
        (await response!.json()).data.should.equal(42);
        await server.dispose();
    });

    it('should report completion before the first value as a server error', async () => {
        const subject = new CurrentValueSubject<number>();
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Number', schema: z.object({}), observe: () => subject
        })] });
        const pending = server.handle(new Request('http://localhost/api/number?waitForFirstResult=true'));
        await new Promise(resolve => setTimeout(resolve, 10));
        subject.complete();
        const result = await pending;
        result?.status.should.equal(500);
        (await result!.json()).hasExceptions.should.equal(true);
        await server.dispose();
    });

    it('should send direct SSE frames without a hub envelope', async () => {
        const subject = new CurrentValueSubject<number[]>({ hasValue: true, value: [5] });
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => subject
        })] });
        const response = await server.handle(new Request('http://localhost/api/numbers', {
            headers: { accept: 'text/event-stream' }
        }));
        response?.headers.get('content-type')?.should.equal('text/event-stream; charset=utf-8');
        const reader = response!.body!.getReader();
        const first = await reader.read();
        const text = new TextDecoder().decode(first.value);
        text.startsWith('data: {').should.equal(true);
        text.endsWith('}\n\n').should.equal(true);
        JSON.parse(text.slice(6)).data.should.deep.equal([5]);
        await reader.cancel();
        await server.dispose();
    });

    it('should authorize before validation and never create a source for a denied caller', async () => {
        let observed = false;
        let validated = false;
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Private', schema: z.object({ count: z.number() }), authorization: { authenticated: true },
            validate: () => { validated = true; return []; },
            observe: () => { observed = true; return new CurrentValueSubject<number>(); }
        })] });
        const session = await server.openObservableQuery('Private', {}, execution());
        should().equal(session.rejection?.isAuthorized, false);
        should().equal(validated, false);
        should().equal(observed, false);
        await server.dispose();
    });

    it('should retain a scoped dependency and tenant context until unsubscribe', async () => {
        const token = serviceToken<{ tenant: string; [Symbol.asyncDispose](): Promise<void> }>('subscription');
        let disposals = 0;
        const subject = new CurrentValueSubject<string>();
        const server = new ArcServer({ services: [{ token, lifetime: 'scoped', factory: (_, context) => ({
            tenant: context.tenantId ?? '', async [Symbol.asyncDispose]() { disposals++; }
        }) }], observableQueries: [defineObservableQuery({
            name: 'Live', schema: z.object({}), handlerDependencies: [token],
            observe: async () => { const value = await currentServices().resolve(token); return {
                subscribe(observer: ObservableObserver<string>) {
                    const subscription = subject.subscribe({ ...observer, next: () => observer.next(value.tenant) });
                    return subscription;
                }
            }; }
        })] });
        const session = await server.openObservableQuery('Live', {}, execution({ tenantId: 'second' }));
        const emissions = session.results();
        const next = emissions.next();
        subject.next('notification');
        (await next).value?.data.should.equal('second');
        await emissions.return(undefined);
        disposals.should.equal(1);
        await server.dispose();
    });

    it('should reject new subscriptions at the configured global limit', async () => {
        const server = new ArcServer({ maxObservableSubscriptions: 1, observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => new CurrentValueSubject<number>()
        })] });
        const first = await server.openObservableQuery('Numbers', {}, execution());
        await shouldRejectWithError(server.openObservableQuery('Numbers', {}, execution()), /subscription limit reached/);
        await first.close();
        const second = await server.openObservableQuery('Numbers', {}, execution());
        await second.close();
        await server.dispose();
    });

    it('should not export an ordinary query proxy for an observable query', async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), clientOutput: { output: { kind: 'array', element: { kind: 'number' } } },
            observe: () => new CurrentValueSubject<number[]>()
        })] });
        should().throw(() => exportClientManifest(server), /observable query proxy generation is not supported/);
        await server.dispose();
    });

    it('should iterate async sources and release them on cancellation', async () => {
        let released = false;
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Sequence', schema: z.object({}), observe: () => (async function* () {
                try { yield 1; yield 2; }
                finally { released = true; }
            })()
        })] });
        const session = await server.openObservableQuery('Sequence', {}, execution());
        const stream = session.results();
        (await stream.next()).value?.data.should.equal(1);
        await stream.return(undefined);
        should().equal(released, true);
        await server.dispose();
    });
});
