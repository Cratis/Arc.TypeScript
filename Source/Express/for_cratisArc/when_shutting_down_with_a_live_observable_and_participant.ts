// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import express from 'express';
import WebSocket from 'ws';
import { z } from 'zod';
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, CurrentValueSubject, defineObservableQuery, ServiceLifetime, serviceToken,
    currentServices } from '@cratis/arc.core';
import { cratisArc } from '../index.js';

should();
describe('when Express coordinates shutdown with a live observable and participant', () => {
    let events: string[];
    beforeEach(async () => {
        events = [];
        let stop!: () => void;
        const stopped = new Promise<void>(resolve => { stop = resolve; });
        const dependency = serviceToken<object>('Express-scoped resource');
        const server = new ArcServer({ services: [{ token: dependency, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ [Symbol.asyncDispose]: async () => {
                await stopped; events.push('scope disposed');
            } }) }], observableQueries: [defineObservableQuery({ name: 'Live', schema: z.object({}),
            handlerDependencies: [dependency], observe: async () => {
                await currentServices().resolve(dependency); return CurrentValueSubject.of(1);
            } })] });
        const app = express();
        const middleware = cratisArc(server);
        app.use(middleware);
        const listener = app.listen(0, '127.0.0.1');
        await new Promise<void>(resolve => listener.once('listening', resolve));
        middleware.injectWebSocket(listener);
        const address = listener.address();
        if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
        const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/live`);
        socket.on('error', () => {});
        try {
            await new Promise<void>((resolve, reject) => {
                socket.once('message', () => resolve()); socket.once('error', reject);
            });
            server.services.addShutdownParticipant({ stop: () => { events.push('stop'); stop(); },
                drain: async () => { events.push('drain'); } });
            await middleware.shutdown(listener);
        } finally { stop(); socket.terminate(); await middleware.close(listener).catch(() => {}); }
    });
    it('should drain the participant before disposing the subscription scope', () => {
        events.should.deep.equal(['stop', 'drain', 'scope disposed']);
    });
});
