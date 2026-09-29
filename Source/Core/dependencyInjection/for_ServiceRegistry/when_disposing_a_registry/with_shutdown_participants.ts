// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when disposing a registry with shutdown participants', () => {
    let events: string[];
    let beforeRelease: string[];
    let sameShutdown: boolean;
    let admittedAfterStop: boolean;
    beforeEach(async () => {
        events = [];
        const scoped = serviceToken<object>('scoped');
        const singleton = serviceToken<object>('singleton');
        const late = serviceToken<object>('late scoped dependency');
        const drainEntered = gate(); const releaseDrain = gate();
        const registry = new ServiceRegistry([
            { token: scoped, lifetime: ServiceLifetime.Scoped, factory: () => ({ [Symbol.dispose]: () => { events.push('scope disposed'); } }) },
            { token: late, lifetime: ServiceLifetime.Scoped, factory: () => ({}) },
            { token: singleton, lifetime: ServiceLifetime.Singleton, factory: () => ({ [Symbol.dispose]: () => { events.push('singleton disposed'); } }) }
        ]);
        const scope = registry.createScope(serviceContext('tenant'));
        try {
            await scope.resolve(scoped);
            await scope.resolve(singleton);
            registry.addShutdownParticipant({
                stop: () => { events.push('first stop'); admittedAfterStop = true;
                    try { registry.createScope(serviceContext('late')); } catch { admittedAfterStop = false; }
                },
                drain: async () => {
                    events.push('first drain');
                    await scope.resolve(late); // Previously admitted work can still resolve services.
                    drainEntered.release(); await releaseDrain.promise;
                    events.push('first drained');
                }
            });
            registry.addShutdownParticipant({ stop: () => { events.push('second stop'); }, drain: async () => { events.push('second drain'); } });
            const closing = registry.dispose();
            sameShutdown = closing === registry.dispose();
            await beforeDeadline(drainEntered.promise, 'participant drain admission');
            beforeRelease = [...events];
            releaseDrain.release();
            await beforeDeadline(closing, 'participant drain');
        } finally { releaseDrain.release(); await registry.dispose(); }
    });
    it('should stop all participants before draining any of them', () => {
        beforeRelease.slice(0, 3).should.deep.equal(['first stop', 'second stop', 'first drain']);
    });
    it('should not dispose dependencies before every drain settles', () => {
        beforeRelease.should.not.contain('scope disposed');
        beforeRelease.should.not.contain('singleton disposed');
        events.slice(-2).should.deep.equal(['scope disposed', 'singleton disposed']);
    });
    it('should close admission before invoking stop', () => admittedAfterStop.should.be.false);
    it('should share one shutdown between concurrent and repeated callers', () => sameShutdown.should.be.true);
});
