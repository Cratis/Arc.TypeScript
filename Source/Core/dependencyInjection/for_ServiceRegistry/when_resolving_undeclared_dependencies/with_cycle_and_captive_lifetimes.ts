// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { captureFailure, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when resolving undeclared dependencies with cycle and captive lifetimes', () => {
    let cycleFailure: unknown; let captiveFailure: unknown;
    beforeEach(async () => {
        const recursive = serviceToken<object>('recursive'); const scoped = serviceToken<object>('scoped');
        const singleton = serviceToken<object>('singleton');
        const registry = new ServiceRegistry([
            { token: recursive, lifetime: 'scoped', factory: resolver => resolver.resolve(recursive) },
            { token: scoped, lifetime: 'scoped', factory: () => ({}) },
            { token: singleton, lifetime: 'singleton', factory: resolver => resolver.resolve(scoped) }
        ]);
        try {
            cycleFailure = await captureFailure(registry.createScope(serviceContext('alpha')).resolve(recursive));
            captiveFailure = await captureFailure(registry.createScope(serviceContext('beta')).resolve(singleton));
        } finally { await registry.dispose(); }
    });
    it('should detect the dynamic resolution cycle', () => (cycleFailure as Error).message.should.match(/cycle/));
    it('should reject the captive dependency', () => (captiveFailure as Error).message.should.match(/Captive/));
});
