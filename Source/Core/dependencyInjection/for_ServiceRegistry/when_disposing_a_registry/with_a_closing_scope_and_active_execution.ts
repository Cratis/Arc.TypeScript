// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when disposing a registry with a closing scope and active execution', () => {
    let sameShutdown: boolean;
    let scopeFailure: unknown;
    let failure: unknown;
    let beforeDrain: string[];
    let afterDrain: string[];
    let repeatedFailure: unknown;
    beforeEach(async () => {
        const scoped = serviceToken<object>('failing scoped cleanup');
        const singleton = serviceToken<object>('singleton cleanup');
        const started = gate(); const releaseExecution = gate();
        const insideDisposer = gate(); const releaseDisposer = gate();
        const events: string[] = [];
        const registry = new ServiceRegistry([
            { token: scoped, lifetime: ServiceLifetime.Scoped, factory: () => ({ [Symbol.asyncDispose]: async () => {
                insideDisposer.release(); await releaseDisposer.promise;
                events.push('scope failed'); throw new Error('captured cleanup failure');
            } }) },
            { token: singleton, lifetime: ServiceLifetime.Singleton,
                factory: () => ({ [Symbol.dispose]: () => { events.push('singleton disposed'); } }) }
        ]);
        const scope = registry.createScope(serviceContext('alpha'));
        try {
            await scope.resolve(scoped);
            await scope.resolve(singleton);
            const execution = registry.runExecution(async () => { started.release(); await releaseExecution.promise; });
            await started.promise;
            const closing = scope.dispose();
            await insideDisposer.promise;
            const shutdown = registry.dispose();
            sameShutdown = shutdown === registry.dispose();
            releaseDisposer.release();
            scopeFailure = await captureFailure(beforeDeadline(closing, 'scope cleanup failure'));
            beforeDrain = [...events];
            releaseExecution.release();
            await beforeDeadline(execution, 'execution drainage');
            failure = await beforeDeadline(captureFailure(shutdown), 'captured failure shutdown');
            afterDrain = [...events];
        } finally {
            releaseExecution.release(); releaseDisposer.release();
            repeatedFailure = await captureFailure(registry.dispose());
        }
    });
    it('should join the same shutdown and record the closing scope failure', () => {
        sameShutdown.should.equal(true);
        (scopeFailure as Error).message.should.match(/Service disposal failed/);
        beforeDrain.should.deep.equal(['scope failed']);
    });
    it('should retain the scope failure in the registry shutdown result', () => {
        (failure instanceof AggregateError).should.equal(true);
        (failure as AggregateError).message.should.match(/Service registry disposal failed/);
        const captured: unknown = (failure as AggregateError).errors[0];
        (captured instanceof AggregateError).should.equal(true);
        ((captured as AggregateError).errors[0] as Error).message.should.equal('captured cleanup failure');
        (repeatedFailure as Error).message.should.match(/Service registry disposal failed/);
    });
    it('should dispose the singleton only after the execution drains', () => afterDrain.should.deep.equal(['scope failed', 'singleton disposed']));
});
