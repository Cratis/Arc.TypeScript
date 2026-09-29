// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../ArcServer.js';
import { ServiceRegistry } from '../dependencyInjection/ServiceRegistry.js';

should();
describe('when constructing a server with an already disposed borrowed registry', () => {
    let failure: unknown;
    beforeEach(async () => {
        const registry = new ServiceRegistry();
        await registry.dispose();
        try { new ArcServer({ services: registry }); } catch (error) { failure = error; }
    });
    it('should construct the server', () => should().equal(failure, undefined));
});
