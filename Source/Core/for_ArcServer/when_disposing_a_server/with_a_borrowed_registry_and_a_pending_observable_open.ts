// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { ServiceRegistry } from '../../dependencyInjection/ServiceRegistry.js';
import { beforeDeadline, captureFailure, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();
describe('when a server with a borrowed registry is disposed while an observable open is pending and there are no participants', () => {
    let disposedWhileOpening: boolean;
    let openingFailure: unknown;
    beforeEach(async () => {
        const entered = gate(); const release = gate();
        const registry = new ServiceRegistry();
        const server = new ArcServer({ services: registry, observableQueries: [defineObservableQuery({ name: 'Pending',
            schema: z.object({}), observe: async () => {
                entered.release(); await release.promise; return CurrentValueSubject.of(1);
            } })] });
        const opening = captureFailure(server.openObservableQuery('Pending', {}, observableExecution()));
        try {
            await beforeDeadline(entered.promise, 'observable observe entry');
            let disposed = false;
            const disposing = server.dispose().then(() => { disposed = true; });
            await beforeDeadline(new Promise(resolve => setTimeout(resolve, 50)), 'dispose window');
            disposedWhileOpening = disposed;
            release.release();
            openingFailure = await beforeDeadline(opening, 'pending observable opening');
            await beforeDeadline(disposing, 'borrowed server disposal');
        } finally { release.release(); await opening; await registry.dispose(); }
    });
    it('should not wait for the pending open', () => disposedWhileOpening.should.equal(true));
    it('should reject the opening once it completes', () => (openingFailure as Error).message.should.equal('Arc server is disposed'));
});
