// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when disposing a registry with failing shutdown participants', () => {
    let failure: AggregateError;
    let repeatedFailure: unknown;
    let beforeRelease: string[];
    let events: string[];
    beforeEach(async () => {
        events = [];
        const scoped = serviceToken<object>('scoped');
        const singleton = serviceToken<object>('singleton');
        const drainEntered = gate(); const releaseDrain = gate();
        const registry = new ServiceRegistry([
            { token: scoped, lifetime: ServiceLifetime.Scoped, factory: () => ({ [Symbol.dispose]: () => { events.push('scope disposed'); throw new Error('scope failed'); } }) },
            { token: singleton, lifetime: ServiceLifetime.Singleton, factory: () => ({ [Symbol.dispose]: () => { events.push('singleton disposed'); } }) }
        ]);
        const scope = registry.createScope(serviceContext('tenant'));
        await scope.resolve(scoped); await scope.resolve(singleton);
        registry.addShutdownParticipant({ stop: () => { events.push('first stopped'); throw new Error('stop failed'); },
            drain: async () => { events.push('first drained'); throw new Error('drain failed'); } });
        registry.addShutdownParticipant({ stop: () => { events.push('second stopped'); },
            drain: async () => { events.push('second draining'); drainEntered.release(); await releaseDrain.promise; events.push('second drained'); } });
        try {
            const closing = registry.dispose();
            await beforeDeadline(drainEntered.promise, 'second drain');
            beforeRelease = [...events];
            releaseDrain.release();
            failure = await beforeDeadline(captureFailure(closing), 'failure shutdown') as AggregateError;
            repeatedFailure = await captureFailure(registry.dispose());
        } finally { releaseDrain.release(); }
    });
    it('should invoke every stop and await every drain despite failures', () => {
        beforeRelease.should.include('second stopped');
        beforeRelease.should.include('second draining');
        beforeRelease.should.not.include('scope disposed');
        events.slice(-3).should.deep.equal(['second drained', 'scope disposed', 'singleton disposed']);
    });
    it('should report stop, drain, and disposal failures together to all callers', () => {
        failure.message.should.equal('Service registry disposal failed');
        (repeatedFailure === failure).should.equal(true);
        (failure.errors[0] as Error).message.should.equal('stop failed');
        (failure.errors[1] as Error).message.should.equal('drain failed');
        ((failure.errors[2] as AggregateError).errors[0] as Error).message.should.equal('scope failed');
    });
});
