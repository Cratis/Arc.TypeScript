// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, CurrentValueSubject, ObservableEmissionDecision, Severity, defineObservableQuery, serviceToken } from '../src/index.js';
import type { ExecutionContext, ObservableEmissionGuard, ObservableObserver } from '../src/index.js';
import { shouldRejectWithError } from './shouldRejectWithError.js';

should();

function source<T>(subject: CurrentValueSubject<T>): { subscribe(observer: ObservableObserver<T>): { unsubscribe(): void }; count(): number;
    opened(): Promise<void> } {
    let active = 0;
    let notify!: () => void;
    const ready = new Promise<void>(resolve => { notify = resolve; });
    return {
        count: () => active,
        opened: () => ready,
        subscribe(observer) {
            active++;
            const subscription = subject.subscribe(observer);
            notify();
            return { unsubscribe: () => { active--; subscription.unsubscribe(); } };
        }
    };
}

const context = (): ExecutionContext => ({
    correlationId: crypto.randomUUID(), allowedSeverity: Severity.Warning,
    principal: undefined, tenantId: undefined, signal: new AbortController().signal
});

describe('observable source cleanup', () => {
    it('should unsubscribe after an HTTP wait has delivered one result', async () => {
        const subject = new CurrentValueSubject<number>();
        const tracked = source(subject);
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => tracked
        })] });
        const pending = server.handle(new Request('http://localhost/api/value?waitForFirstResult=True'));
        await tracked.opened();
        subject.next(3);
        const response = await pending;
        response?.status.should.equal(200);
        (await response!.json()).data.should.equal(3);
        tracked.count().should.equal(0);
        await server.dispose();
    });

    it('should unsubscribe after SSE cancellation with a queued emission', async () => {
        const subject = new CurrentValueSubject<number>(1);
        const tracked = source(subject);
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => tracked
        })] });
        const response = await server.handle(new Request('http://localhost/api/value', {
            headers: { accept: 'text/event-stream' }
        }));
        const reader = response!.body!.getReader();
        await reader.read();
        subject.next(2);
        await reader.cancel();
        tracked.count().should.equal(0);
        await server.dispose();
    });

    it('should unsubscribe on a terminal guard denial', async () => {
        const subject = new CurrentValueSubject<number>(1);
        const tracked = source(subject);
        const guard = serviceToken<ObservableEmissionGuard>('deny second');
        const server = new ArcServer({ services: [{ token: guard, lifetime: 'scoped', factory: (): ObservableEmissionGuard => ({
            check: emission => emission.data === 2 ? ObservableEmissionDecision.DenyAndTerminate : ObservableEmissionDecision.Allow
        }) }], observableEmissionGuards: [guard], observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => tracked
        })] });
        const response = await server.handle(new Request('http://localhost/api/value', {
            headers: { accept: 'text/event-stream' }
        }));
        const reader = response!.body!.getReader();
        await reader.read();
        subject.next(2);
        const terminal = new TextDecoder().decode((await reader.read()).value);
        JSON.parse(terminal.slice(6)).isAuthorized.should.equal(false);
        should().equal((await reader.read()).done, true);
        tracked.count().should.equal(0);
        await server.dispose();
    });

    it('should unsubscribe every source when the server disposes', async () => {
        const subject = new CurrentValueSubject<number>(1);
        const tracked = source(subject);
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => tracked
        })] });
        const session = await server.openObservableQuery('Value', {}, context());
        const stream = session.results();
        await stream.next();
        await server.dispose();
        tracked.count().should.equal(0);
    });

    it('should report a producer that ignores cancellation rather than claim cleanup succeeded', async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Stuck', schema: z.object({}), observe: () => (async function* () {
                yield 1;
                await new Promise<void>(() => {});
            })()
        })] });
        const session = await server.openObservableQuery('Stuck', {}, context());
        const stream = session.results();
        await stream.next();
        const pending = stream.next().catch(() => undefined);
        await shouldRejectWithError(session.close(), /cleanup failed/);
        await pending;
        await server.dispose();
    });

    it('should cancel a cooperative async producer blocked while reading its next emission', async () => {
        let released = false;
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: (_input, execution) => (async function* () {
                try {
                    yield 1;
                    await new Promise<void>(resolve => execution.signal.addEventListener('abort', () => resolve(), { once: true }));
                } finally { released = true; }
            })()
        })] });
        const session = await server.openObservableQuery('Value', {}, context());
        const stream = session.results();
        await stream.next();
        const pending = stream.next();
        await session.close();
        await pending;
        should().equal(released, true);
        await server.dispose();
    });
});
