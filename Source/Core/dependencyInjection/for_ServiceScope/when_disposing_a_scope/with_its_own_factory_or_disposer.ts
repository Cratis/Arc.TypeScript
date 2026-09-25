// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, captureFailure, serviceContext } from '../../for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when disposing a scope with its own factory or disposer', () => {
    let factoryFailure: unknown;
    let disposerFailure: unknown;
    beforeEach(async () => {
        const token = serviceToken<object>('self');
        const registry = new ServiceRegistry([{ token, lifetime: ServiceLifetime.Scoped, factory: async scope => {
            factoryFailure = await captureFailure(scope.dispose());
            return { [Symbol.asyncDispose]: async () => { disposerFailure = await captureFailure(scope.dispose()); } };
        } }]);
        const scope = registry.createScope(serviceContext('alpha'));
        await beforeDeadline(scope.resolve(token), 'scope self-await');
        await beforeDeadline(scope.dispose(), 'scope disposal');
        await registry.dispose();
    });
    it('should reject its factory awaiting its own closure', () => (factoryFailure as Error).message.should.match(/Cannot await/));
    it('should reject its disposer awaiting its own closure', () => (disposerFailure as Error).message.should.match(/Cannot await/));
});
