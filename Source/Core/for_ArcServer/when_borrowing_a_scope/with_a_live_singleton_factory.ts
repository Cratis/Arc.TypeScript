// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { ServiceDependencyError } from '../../dependencyInjection/ServiceDependencyError.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { captureFailure, serviceContext, beforeDeadline } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when a singleton factory borrows a scope and resolves a scoped dependency', () => {
    let failure: unknown;
    let captiveFailure: unknown;
    beforeEach(async () => {
        const scoped = serviceToken<object>('borrowed scoped dependency');
        const singleton = serviceToken<object>('singleton owner');
        const server = new ArcServer({ services: [
            { token: scoped, lifetime: ServiceLifetime.Scoped, factory: () => ({}) },
            { token: singleton, lifetime: ServiceLifetime.Singleton, factory: async () => {
                const borrowed = server.services.createScope(serviceContext('borrowed'));
                try { captiveFailure = await captureFailure(server.runInScope(borrowed, () => borrowed.resolve(scoped))); }
                finally { await borrowed.dispose(); }
                return {};
            } }
        ] });
        const root = server.services.createScope(serviceContext('root'));
        try { failure = await beforeDeadline(captureFailure(root.resolve(singleton)), 'singleton factory'); }
        finally { await root.dispose(); await server.dispose(); }
    });
    it('should retain the singleton captive dependency guard', () => {
        (captiveFailure instanceof ServiceDependencyError).should.equal(true);
        (captiveFailure as Error).message.should.match(/Captive service dependency/);
    });
    it('should leave the registry usable when the factory handles the captive failure', () => (failure === undefined).should.equal(true));
});
