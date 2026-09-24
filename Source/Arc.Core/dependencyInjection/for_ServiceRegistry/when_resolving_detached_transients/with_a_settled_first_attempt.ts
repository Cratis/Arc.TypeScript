// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, gate, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when resolving detached transients with a settled first attempt', () => {
    let first: object;
    let second: object;
    let constructions: number;
    let disposals: number;
    beforeEach(async () => {
        const token = serviceToken<object>('detached transient');
        const released = gate();
        let detached!: Promise<object>;
        constructions = disposals = 0;
        const registry = new ServiceRegistry([{ token, lifetime: 'transient', factory: resolver => {
            constructions++;
            if (constructions === 1) detached = (async () => { await released.promise; return resolver.resolve(token); })();
            return { [Symbol.dispose]: () => { disposals++; } };
        } }]);
        const scope = registry.createScope(serviceContext('alpha'));
        try {
            first = await scope.resolve(token);
            released.release();
            second = await beforeDeadline(detached, 'detached transient retry');
            await scope.dispose();
        } finally { released.release(); await registry.dispose(); }
    });
    it('should create a fresh instance for detached re-resolution', () => {
        (first === second).should.equal(false);
        constructions.should.equal(2);
    });
    it('should dispose both transient instances', () => disposals.should.equal(2));
});
