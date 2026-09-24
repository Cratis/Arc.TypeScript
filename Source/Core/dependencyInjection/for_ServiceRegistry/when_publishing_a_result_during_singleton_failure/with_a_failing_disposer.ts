// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { currentServices } from '../../ServiceScope.js';
import { serviceToken } from '../../ServiceToken.js';
import { defineQuery } from '../../../queries/defineQuery.js';
import { originalFailure } from '../../../results/failureTracking.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when publishing a result during singleton failure with a failing disposer', () => {
    let outcomes: { success: Awaited<ReturnType<ArcServer['performQuery']>>; failed: Awaited<ReturnType<ArcServer['performQuery']>>;
        recorded: unknown; events: string[]; shutdownFailure: unknown; throwingDisposer: boolean }[];
    beforeEach(async () => {
        outcomes = [];
        for (const throwingDisposer of [false, true]) {
            const partial = serviceToken<object>('partial singleton');
            const broken = serviceToken<object>('broken singleton');
            const inCompletion = gate(); const brokenEntered = gate(); const releaseBroken = gate(); const failureObserved = gate();
            const events: string[] = [];
            const server = new ArcServer({ services: [
                { token: partial, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => {
                    events.push('singleton disposed');
                    if (throwingDisposer) throw new Error('singleton cleanup failed');
                } }) },
                { token: broken, lifetime: 'singleton', factory: async () => {
                    brokenEntered.release(); await releaseBroken.promise;
                    throw new Error('singleton factory failed');
                } }
            ], queries: [
                defineQuery({ name: 'Successful', schema: z.object({}), perform: async () => { await currentServices().resolve(partial); return 'private data'; } }),
                defineQuery({ name: 'Broken', schema: z.object({}), handlerDependencies: [broken], perform: () => 'unexpected' })
            ] });
            const registry = server.services;
            const run = registry.runExecution.bind(registry);
            registry.runExecution = <T>(callback: () => Promise<T>, completed?: (result: T, living: boolean) => Promise<T>): Promise<T> =>
                run(async () => {
                    const saved = await callback();
                    if (typeof saved === 'object' && saved !== null && 'data' in saved && saved.data === 'private data') {
                        inCompletion.release(); await brokenEntered.promise; releaseBroken.release(); await failureObserved.promise;
                    }
                    return saved;
                }, completed);
            const mark = registry.markSingletonFailure.bind(registry);
            registry.markSingletonFailure = () => { mark(); failureObserved.release(); };
            try {
                const prepared = server.performQuery('Successful', {}, serviceContext('alpha'));
                await beforeDeadline(inCompletion.promise, 'successful completion intercepted');
                const failing = server.performQuery('Broken', {}, serviceContext('beta'));
                await beforeDeadline(failureObserved.promise, 'singleton failure observed');
                const success = await beforeDeadline(prepared, 'successful result invalidation');
                const failed = await beforeDeadline(failing, 'failed singleton shutdown');
                const recorded = originalFailure(failed);
                const first: unknown = recorded instanceof AggregateError ? recorded.errors[0] : recorded;
                const shutdownFailure = await captureFailure(registry.dispose());
                outcomes.push({ success, failed, recorded: first, events, shutdownFailure, throwingDisposer });
            } finally { releaseBroken.release(); }
        }
    });
    it('should prevent the prepared result from publishing after singleton failure', () => {
        for (const { success } of outcomes) {
            success.isSuccess.should.equal(false);
            (success.data === undefined).should.equal(true);
            success.exceptionMessages.join(' ').should.match(/Service registry is disposed/);
        }
    });
    it('should retain the original factory failure and reject the failing result', () => {
        for (const { failed, recorded } of outcomes) {
            failed.isSuccess.should.equal(false);
            failed.exceptionMessages.join(' ').should.match(/Service factory failed: broken singleton/);
            (recorded instanceof Error).should.equal(true);
            String((recorded as Error).cause).should.match(/singleton factory failed/);
        }
    });
    it('should join singleton disposal and report its failure if it throws', () => {
        for (const { success, failed, events, shutdownFailure, throwingDisposer } of outcomes) {
            events.should.deep.equal(['singleton disposed']);
            if (throwingDisposer) {
                success.exceptionMessages.join(' ').should.match(/Service registry disposal failed/);
                failed.exceptionMessages.join(' ').should.match(/Service registry disposal failed/);
                (shutdownFailure as Error).message.should.match(/Service registry disposal failed/);
            } else (shutdownFailure === undefined).should.equal(true);
        }
    });
});
