// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { HubSubscriptionOutcome } from '../HubSubscriptionOutcome.js';
import { a_query_connection } from './given/a_query_connection.js';

should();

describe('when closing a connection with a pending producer', () => {
    let context: a_query_connection;
    let error: unknown;
    let outcome: HubSubscriptionOutcome;

    beforeEach(async () => {
        let release!: () => void;
        const blocked = new Promise<void>(resolve => { release = resolve; });
        let started!: () => void;
        const opening = new Promise<void>(resolve => { started = resolve; });
        context = new a_query_connection(new ArcServer({ observableHandshakeTimeoutMs: 10, observableShutdownTimeoutMs: 10,
            observableQueries: [defineObservableQuery({ name: 'Slow', schema: z.object({}),
                observe: async () => { started(); await blocked; return CurrentValueSubject.of(1); } })] }));
        await context.connection.connect();
        const admission = context.connection.subscribe('q', 1, { queryName: 'Slow' });
        await opening;
        try { await context.connection.close(); } catch (reason) { error = reason; }
        release();
        outcome = await admission;
    });

    afterEach(async () => { await context.server.dispose(); });

    it('should report the shutdown timeout', () => {
        (error instanceof Error).should.be.true;
        (error as Error).message.should.match(/Observable hub shutdown timed out/);
    });
    it('should mark the late admission stale', () => { outcome.should.equal(HubSubscriptionOutcome.Stale); });
});
