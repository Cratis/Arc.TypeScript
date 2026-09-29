// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceRegistry } from '../../dependencyInjection/ServiceRegistry.js';
import { beforeDeadline, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { runArc } from '../../http/runArc.js';

should();
describe('when a borrowed registry shuts down before admitted WebSocket delivery completes', () => {
    let events: string[];
    let joinedBeforeRelease: boolean;
    beforeEach(async () => {
        events = [];
        const delivery = gate(); const entered = gate(); const drained = gate();
        const services = new ServiceRegistry();
        const server = new ArcServer({ services });
        server.handleObservableHubSocket = async () => {
            entered.release(); await delivery.promise; events.push('delivery completed');
        };
        const listener = await runArc(server, { port: 0 });
        const socket = new WebSocket(`ws://127.0.0.1:${(listener.server.address() as AddressInfo).port}/.cratis/queries/ws`);
        socket.on('error', () => {});
        try {
            await beforeDeadline(entered.promise, 'borrowed delivery entry');
            services.addShutdownParticipant({ stop: () => { events.push('stop'); },
                drain: async () => { events.push('drain'); drained.release(); } });
            const closing = services.dispose();
            await beforeDeadline(drained.promise, 'borrowed participant drain');
            let completed = false;
            const serverClosing = server.dispose().then(() => { completed = true; });
            await Promise.resolve();
            joinedBeforeRelease = completed;
            delivery.release();
            await beforeDeadline(closing, 'borrowed registry delivery join');
            await beforeDeadline(serverClosing, 'borrowed server delivery join');
        } finally { delivery.release(); socket.terminate(); await listener.close().catch(() => {}); }
    });
    it('should join delivery after all participants drain before registry and server disposal settle', () => {
        joinedBeforeRelease.should.equal(false);
        events.should.deep.equal(['stop', 'drain', 'delivery completed']);
    });
});
