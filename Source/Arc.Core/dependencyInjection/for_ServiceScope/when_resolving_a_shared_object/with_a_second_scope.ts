// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { captureFailure, serviceContext } from '../../for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when resolving a shared object with a second scope', () => {
    let firstOwned: boolean; let secondFailure: unknown; let disposals: number;
    beforeEach(async () => {
        const token = serviceToken<object>('shared scoped object'); disposals = 0;
        const shared = { [Symbol.dispose]: () => { disposals++; } };
        const registry = new ServiceRegistry([{ token, lifetime: 'scoped', factory: () => shared }]);
        const first = registry.createScope(serviceContext('first'));
        const second = registry.createScope(serviceContext('second'));
        firstOwned = await first.resolve(token) === shared;
        secondFailure = await captureFailure(second.resolve(token));
        await registry.dispose();
    });
    it('should reject conflicting ownership and dispose the original exactly once', () => {
        firstOwned.should.equal(true);
        (secondFailure as Error).message.should.match(/Conflicting service ownership/);
        disposals.should.equal(1);
    });
});
