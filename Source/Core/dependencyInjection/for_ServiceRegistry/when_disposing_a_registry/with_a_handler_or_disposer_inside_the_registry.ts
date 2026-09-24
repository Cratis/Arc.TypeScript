// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { defineQuery } from '../../../queries/defineQuery.js';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { currentServices } from '../../ServiceScope.js';
import { serviceToken } from '../../ServiceToken.js';
import { beforeDeadline, captureFailure, serviceContext } from '../given/a_service_lifecycle.js';

should();
describe('when disposing a registry with a handler or disposer inside the registry', () => {
    let handlerFailure: unknown;
    let disposerFailure: unknown;
    let successful: boolean;
    beforeEach(async () => {
        const token = serviceToken<object>('disposer');
        const registry = new ServiceRegistry([{ token, lifetime: 'scoped', factory: () => ({
            [Symbol.asyncDispose]: async () => { disposerFailure = await captureFailure(registry.dispose()); }
        }) }]);
        const server = new ArcServer({ services: registry, queries: [defineQuery({ name: 'Self', schema: z.object({}), perform: async () => {
            await currentServices().resolve(token);
            handlerFailure = await captureFailure(registry.dispose());
            return 'done';
        } })] });
        const result = await beforeDeadline(server.performQuery('Self', {}, serviceContext('self')), 'self-await prevention');
        successful = result.isSuccess;
        await beforeDeadline(registry.dispose(), 'external dispose');
    });
    it('should reject shutdown awaited by the handler', () => (handlerFailure as Error).message.should.match(/Cannot await/));
    it('should reject shutdown awaited by a disposer', () => (disposerFailure as Error).message.should.match(/Cannot await/));
    it('should allow the external disposal to finish', () => successful.should.be.true);
});
