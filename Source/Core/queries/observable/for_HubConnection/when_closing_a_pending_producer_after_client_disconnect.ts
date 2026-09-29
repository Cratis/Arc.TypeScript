// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import type { ExecutionContext } from '../../../execution/ExecutionContext.js';
import { Severity } from '../../../validation/Severity.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { HubConnection } from '../HubConnection.js';

should();

describe('when a client disconnects while a producer is still opening', () => {
    let server: ArcServer;
    let release: () => void;
    let closedAtTimeout: number;
    let changedAtTimeout: number;
    let closedAfterRelease: number;

    beforeEach(async () => {
        const blocked = new Promise<void>(resolve => { release = resolve; });
        let started!: () => void;
        const opening = new Promise<void>(resolve => { started = resolve; });
        server = new ArcServer({ query: { observableHandshakeTimeoutMs: 10, observableShutdownTimeoutMs: 10 },
            observableQueries: [defineObservableQuery({ name: 'Slow', schema: z.object({}),
                observe: async () => { started(); await blocked; return CurrentValueSubject.of(1); } })] });
        const controller = new AbortController();
        const output = { signal: controller.signal, lastActivity: Date.now(), send: async () => {}, close: () => { controller.abort(); } };
        const context: ExecutionContext = { correlationId: crypto.randomUUID(), principal: undefined, tenantId: undefined,
            signal: controller.signal, allowedSeverity: Severity.Warning };
        let closed = 0;
        let changed = 0;
        const connection = new HubConnection(server, 'WebSocket', output, context, 0, () => { closed++; }, () => { changed++; });
        await connection.connect();
        const admission = connection.subscribe('q', 1, { queryName: 'Slow' });
        await opening;
        changed = 0;
        controller.abort();
        await connection.close().catch(() => {});
        closedAtTimeout = closed;
        changedAtTimeout = changed;
        release();
        await admission;
        await connection.close().catch(() => {});
        closedAfterRelease = closed;
    });

    afterEach(async () => { await server.dispose(); });

    it('should release the hub slot at the timeout', () => closedAtTimeout.should.equal(1));
    it('should report the change at the timeout', () => changedAtTimeout.should.be.greaterThan(0));
    it('should release the hub slot only once', () => closedAfterRelease.should.equal(1));
});
