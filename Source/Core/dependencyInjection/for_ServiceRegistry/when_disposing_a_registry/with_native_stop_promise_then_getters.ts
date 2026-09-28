// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { ServiceDependencyError } from '../../ServiceDependencyError.js';
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, captureFailure } from '../given/a_service_lifecycle.js';

should();
describe('when a native stop promise has a self-joining then getter', () => {
    let getterFailure: unknown;
    let events: string[];
    beforeEach(async () => {
        events = [];
        const token = serviceToken<object>('owned');
        const registry = new ServiceRegistry([{ token, lifetime: ServiceLifetime.Singleton,
            factory: () => ({ [Symbol.dispose]: () => { events.push('disposed'); } }) }]);
        await registry.singletonScope().resolve(token);
        registry.addShutdownParticipant({ stop: () => {
            const result = Promise.resolve();
            Object.defineProperty(result, 'then', { get: () => {
                void captureFailure(registry.dispose()).then(error => { getterFailure = error; });
                return Promise.prototype.then;
            } });
            return result;
        }, drain: async () => { events.push('drain'); } });
        await beforeDeadline(registry.dispose(), 'native stop self join');
        await Promise.resolve();
    });
    it('should reject the self join and still drain and dispose', () => {
        (getterFailure instanceof ServiceDependencyError).should.equal(true);
        events.should.deep.equal(['drain', 'disposed']);
    });
});

describe('when a native stop promise has a throwing then getter', () => {
    let failure: AggregateError;
    let events: string[];
    let leaf: Error;
    beforeEach(async () => {
        events = [];
        leaf = new Error('stop then getter failed');
        const token = serviceToken<object>('owned');
        const registry = new ServiceRegistry([{ token, lifetime: ServiceLifetime.Singleton,
            factory: () => ({ [Symbol.dispose]: () => { events.push('disposed'); } }) }]);
        await registry.singletonScope().resolve(token);
        registry.addShutdownParticipant({ stop: () => {
            const result = Promise.resolve();
            Object.defineProperty(result, 'then', { get: () => { throw leaf; } });
            return result;
        }, drain: async () => { events.push('drain'); } });
        failure = await beforeDeadline(captureFailure(registry.dispose()), 'native stop getter failure') as AggregateError;
    });
    it('should report the getter failure after draining and disposing', () => {
        failure.errors.should.include(leaf);
        events.should.deep.equal(['drain', 'disposed']);
    });
});
