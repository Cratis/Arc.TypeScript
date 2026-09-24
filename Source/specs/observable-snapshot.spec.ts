// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, CurrentValueSubject, ServiceRegistry, Severity, defineObservableQuery } from '../src/index.js';
import type { ExecutionContext } from '../src/index.js';
import { shouldRejectWithError } from './shouldRejectWithError.js';

should();
const context = (): ExecutionContext => ({
    correlationId: crypto.randomUUID(), signal: new AbortController().signal,
    allowedSeverity: Severity.Warning, principal: undefined, tenantId: undefined
});

describe('observable HTTP snapshots and admission', () => {
    it('should redact both message and stack trace for a failing producer', async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: (): CurrentValueSubject<number> => {
                throw new Error('private database password');
            }
        })] });
        const response = await server.handle(new Request('http://localhost/api/value'));
        response?.status.should.equal(500);
        const body = await response!.json();
        body.exceptionMessages.should.deep.equal(['An unexpected error occurred']);
        body.exceptionStackTrace.should.equal('');
        JSON.stringify(body).includes('private database password').should.equal(false);
        await server.dispose();
    });

    it('should preserve a 408 timeout message without reporting a private failure', async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Pending', schema: z.object({}), observe: () => new CurrentValueSubject<number>()
        })] });
        const response = await server.handle(new Request('http://localhost/api/pending?waitForFirstResult=TrUe&waitForFirstResultTimeout=0.01'));
        response?.status.should.equal(408);
        (await response!.json()).exceptionMessages[0].should.match(/Timed out waiting/);
        await server.dispose();
    });

    it('should preserve the completed-without-value protocol error', async () => {
        const subject = new CurrentValueSubject<number>();
        subject.complete();
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Pending', schema: z.object({}), observe: () => subject
        })] });
        const response = await server.handle(new Request('http://localhost/api/pending?waitForFirstResult=true'));
        response?.status.should.equal(500);
        (await response!.json()).exceptionMessages[0].should.match(/completed before producing/);
        await server.dispose();
    });

    it('should send JSON 400 and 403 for rejected SSE subscriptions', async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Private', schema: z.object({ count: z.number() }),
            authorization: { authenticated: true }, observe: () => new CurrentValueSubject<number>()
        })] });
        const denied = await server.handle(new Request('http://localhost/api/private?count=1', {
            headers: { accept: 'text/event-stream' }
        }));
        denied?.status.should.equal(403);
        denied?.headers.get('content-type')?.should.contain('application/json');
        const invalid = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({ count: z.number() }),
            observe: () => new CurrentValueSubject<number>()
        })] });
        const response = await invalid.handle(new Request('http://localhost/api/value', {
            headers: { accept: 'text/event-stream' }
        }));
        response?.status.should.equal(400);
        response?.headers.get('content-type')?.should.contain('application/json');
        await server.dispose();
        await invalid.dispose();
    });

    it('should return 503 when anonymous callers fill their slots but still allow current snapshots', async () => {
        const subject = new CurrentValueSubject<number>(1);
        const server = new ArcServer({ maxObservableSubscriptions: 16, observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => subject
        })] });
        const streams: Response[] = [];
        for (let index = 0; index < 8; index++) {
            const stream = await server.handle(new Request('http://localhost/api/value', {
                headers: { accept: 'text/event-stream' }
            }));
            stream?.status.should.equal(200);
            streams.push(stream!);
        }
        const limited = await server.handle(new Request('http://localhost/api/value', {
            headers: { accept: 'text/event-stream' }
        }));
        limited?.status.should.equal(503);
        limited?.headers.get('retry-after')?.should.equal('1');
        (await limited!.json()).hasExceptions.should.equal(true);
        const current = await server.handle(new Request('http://localhost/api/value'));
        current?.status.should.equal(200);
        for (const stream of streams) await stream.body?.cancel();
        await server.dispose();
    });

    it('should partition authenticated admission by principal', async () => {
        const server = new ArcServer({ maxObservableSubscriptionsPerCaller: 1,
            authentication: [request => ({ status: AuthenticationStatus.Authenticated,
                principal: { id: request.headers.get('authorization') ?? '', roles: [], isAuthenticated: true } })],
            observableQueries: [defineObservableQuery({ name: 'Value', schema: z.object({}),
                observe: () => new CurrentValueSubject<number>(1) })] });
        const request = (id: string): Request => new Request('http://localhost/api/value', {
            headers: { accept: 'text/event-stream', authorization: id }
        });
        const alice = await server.handle(request('alice'));
        (await server.handle(request('alice')))?.status.should.equal(503);
        const bob = await server.handle(request('bob'));
        bob?.status.should.equal(200);
        await alice?.body?.cancel();
        await bob?.body?.cancel();
        await server.dispose();
    });

    it('should refuse new subscriptions after disposal with an externally owned registry', async () => {
        const registry = new ServiceRegistry();
        const server = new ArcServer({ services: registry, observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => new CurrentValueSubject<number>(1)
        })] });
        await server.dispose();
        await shouldRejectWithError(server.openObservableQuery('Value', {}, context()), 'Arc server is disposed');
        await registry.dispose();
    });

    it('should describe pending, timeout, overload, and SSE responses in OpenAPI', async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => new CurrentValueSubject(1)
        })] });
        const response = await server.handle(new Request('http://localhost/openapi.json'));
        const document = await response!.json();
        const replies = document.paths['/api/value'].get.responses;
        replies['200'].content['text/event-stream'].schema.type.should.equal('string');
        replies['202'].description.should.equal('No current value');
        replies['408'].description.should.equal('First-result wait timed out');
        replies['503'].description.should.equal('Subscription limit reached');
        await server.dispose();
    });

    it('should recognize getValue on a structural behavior subject as a current snapshot', async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => ({
                getValue: () => 7,
                subscribe() { return { unsubscribe() {} }; }
            })
        })] });
        const response = await server.handle(new Request('http://localhost/api/value'));
        response?.status.should.equal(200);
        (await response!.json()).data.should.equal(7);
        await server.dispose();
    });
});
