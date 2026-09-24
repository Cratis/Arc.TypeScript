// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, CurrentValueSubject, Severity, defineObservableQuery } from '../src/index.js';
import type { ExecutionContext } from '../src/index.js';
import type { HubFrame } from '../src/queries/observable/HubFrame.js';
import { HubConnection } from '../src/queries/observable/HubConnection.js';
import { HubFrameType } from '../src/queries/observable/HubFrameType.js';
import { HubSubscriptionOutcome } from '../src/queries/observable/HubSubscriptionOutcome.js';
import { shouldRejectWithError } from './shouldRejectWithError.js';

should();

describe('observable connection bounds', () => {
    it('should release an unknown query id before admitting another subscription', async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => new CurrentValueSubject([1])
        })] });
        const controller = new AbortController();
        const frames: HubFrame[] = [];
        const output = { signal: controller.signal, lastActivity: Date.now(),
            async send(frame: HubFrame) { frames.push(frame); this.lastActivity = Date.now(); },
            close() { controller.abort(); }
        };
        const context: ExecutionContext = { correlationId: crypto.randomUUID(),
            principal: undefined, tenantId: undefined, signal: controller.signal, allowedSeverity: Severity.Warning };
        const connection = new HubConnection(server, 'WebSocket', output, context, 0, () => {}, () => {});
        try {
            for (let index = 0; index < 40; index++) {
                const outcome = await connection.subscribe(`missing${index}`, 1, { queryName: 'Missing' });
                outcome.should.equal(HubSubscriptionOutcome.Invalid);
            }
            connection.subscriptionCount.should.equal(0);
            (await connection.subscribe('real', 1, { queryName: 'Numbers' })).should.equal(HubSubscriptionOutcome.Accepted);
            connection.subscriptionCount.should.equal(1);
        } finally { await connection.close(); await server.dispose(); }
    });

    it('should bound connection shutdown while a producer is still opening', async () => {
        let release!: () => void;
        const blocked = new Promise<void>(resolve => { release = resolve; });
        let started!: () => void;
        const opening = new Promise<void>(resolve => { started = resolve; });
        const server = new ArcServer({ observableHandshakeTimeoutMs: 10,
            observableQueries: [defineObservableQuery({ name: 'Slow', schema: z.object({}),
                observe: async () => { started(); await blocked; return CurrentValueSubject.of(1); } })] });
        const controller = new AbortController();
        const output = { signal: controller.signal, lastActivity: Date.now(),
            async send() { this.lastActivity = Date.now(); }, close() { controller.abort(); }
        };
        const context: ExecutionContext = { correlationId: crypto.randomUUID(), principal: undefined,
            tenantId: undefined, signal: controller.signal, allowedSeverity: Severity.Warning };
        const connection = new HubConnection(server, 'WebSocket', output, context, 0, () => {}, () => {});
        await connection.connect();
        const admission = connection.subscribe('q', 1, { queryName: 'Slow' });
        await opening;
        await connection.close();
        release();
        (await admission).should.equal(HubSubscriptionOutcome.Stale);
        await shouldRejectWithError(server.dispose(), /Observable hub shutdown timed out/);
    });

    it('should reject a 33rd subscription on one physical connection', async () => {
        const server = new ArcServer({ maxObservableSubscriptions: 64, maxObservableSubscriptionsPerCaller: 64,
            maxObservableHubSubscriptionsPerConnection: 32,
            observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}),
                observe: () => new CurrentValueSubject<number[]>([1]) })] });
        const controller = new AbortController();
        const frames: HubFrame[] = [];
        const output = { signal: controller.signal, lastActivity: Date.now(),
            async send(frame: HubFrame) { frames.push(frame); this.lastActivity = Date.now(); },
            close() { controller.abort(); }
        };
        const context: ExecutionContext = { correlationId: crypto.randomUUID(),
            principal: { id: 'alice', isAuthenticated: true, roles: [] }, tenantId: 'first',
            signal: controller.signal, allowedSeverity: Severity.Warning };
        const connection = new HubConnection(server, 'WebSocket', output, context, 0, () => {}, () => {});
        try {
            await connection.connect();
            const admitted = await Promise.all(Array.from({ length: 32 }, (_, index) =>
                connection.subscribe(`q${index}`, 1, { queryName: 'Numbers' })));
            admitted.every(outcome => outcome === HubSubscriptionOutcome.Accepted).should.equal(true);
            connection.subscriptionCount.should.equal(32);
            const denied = await connection.subscribe('q32', 1, { queryName: 'Numbers' });
            denied.should.equal(HubSubscriptionOutcome.Limited);
            frames.some(frame => frame.type === HubFrameType.Error && frame.queryId === 'q32').should.equal(true);
        } finally { await connection.close(); await server.dispose(); }
    });
});
