// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when disposing a registry with an abandoned singleton factory', () => {
    let finishedBeforeRelease: boolean;
    let disposals: number;
    beforeEach(async () => {
        const token = serviceToken<object>('abandoned');
        const entered = gate(); const release = gate(); disposals = 0;
        const registry = new ServiceRegistry([{ token, lifetime: 'singleton', factory: async () => {
            entered.release(); await release.promise;
            return { [Symbol.dispose]: () => { disposals++; } };
        } }]);
        const scope = registry.createScope(serviceContext('alpha'));
        try {
            void scope.resolve(token).catch(() => {});
            await entered.promise;
            const closing = registry.dispose();
            let finished = false;
            void closing.then(() => { finished = true; });
            await Promise.resolve();
            finishedBeforeRelease = finished;
            release.release();
            await beforeDeadline(closing, 'abandoned factory shutdown');
        } finally { release.release(); await registry.dispose(); }
    });
    it('should wait for the abandoned factory', () => finishedBeforeRelease.should.be.false);
    it('should dispose its result exactly once', () => disposals.should.equal(1));
});
