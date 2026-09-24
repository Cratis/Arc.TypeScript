// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { currentServices } from '../../ServiceScope.js';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when resolving a singleton root with detached captive resolutions', () => {
    let initialFailures: unknown[];
    let detachedFailures: unknown[];
    let failed: boolean;
    let creations: number;
    let manualSucceeded: boolean;
    beforeEach(async () => {
        const scoped = serviceToken<object>('scoped'); const transient = serviceToken<object>('transient'); const root = serviceToken<object>('root');
        const release = gate(); let detached!: Promise<void>; creations = 0; detachedFailures = [];
        const registry = new ServiceRegistry([
            { token: scoped, lifetime: 'scoped', factory: () => ({}) },
            { token: transient, lifetime: 'transient', factory: () => ({}) },
            { token: root, lifetime: 'singleton', factory: resolver => {
                creations++;
                detached = (async () => {
                    await release.promise;
                    detachedFailures = [
                        await captureFailure(Promise.resolve().then(() => currentServices().resolve(scoped))),
                        await captureFailure(Promise.resolve().then(() => resolver.resolve(transient)))
                    ];
                })();
                return {};
            } }
        ]);
        try {
            const singletons = registry.singletonScope();
            initialFailures = [
                await captureFailure(Promise.resolve().then(() => singletons.resolve(scoped))),
                await captureFailure(Promise.resolve().then(() => singletons.resolve(transient)))
            ];
            await singletons.resolve(root);
            release.release();
            await beforeDeadline(detached, 'detached root captive check');
            failed = registry.singletonFailed;
            const manual = registry.createScope(serviceContext('manual'));
            manualSucceeded = (await manual.resolve(scoped)) !== undefined;
            await manual.dispose();
        } finally { release.release(); await registry.dispose(); }
    });
    it('should reject captive dependencies outside root factory construction', () => {
        initialFailures.map(error => (error as Error).message).every(message => /Captive service dependency/.test(message)).should.equal(true);
        detachedFailures.map(error => (error as Error).message).every(message => /Captive service dependency/.test(message)).should.equal(true);
    });
    it('should keep healthy singleton and manual scope resolutions usable', () => {
        failed.should.equal(false);
        creations.should.equal(1);
        manualSucceeded.should.equal(true);
    });
});
