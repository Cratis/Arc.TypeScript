// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { serviceToken } from '../../ServiceToken.js';
import { captureFailure, serviceContext } from '../../for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when resolving services with shadowed public getters', () => {
    let sameScoped: boolean;
    let sameRoot: boolean;
    let aliasFailure: unknown;
    let captiveFailure: unknown;
    let scopedCreations: number;
    let rootCreations: number;
    let beforeShutdown: string[];
    let afterShutdown: string[];
    beforeEach(async () => {
        const scoped = serviceToken<object>('scoped');
        const root = serviceToken<object>('root');
        const alias = serviceToken<object>('alias');
        const events: string[] = []; scopedCreations = 0; rootCreations = 0; let firstScoped!: object;
        const registry = new ServiceRegistry([
            { token: scoped, lifetime: ServiceLifetime.Scoped, factory: () => {
                scopedCreations++; return { [Symbol.dispose]: () => { events.push(ServiceLifetime.Scoped); } };
            } },
            { token: root, lifetime: ServiceLifetime.Singleton, factory: () => {
                rootCreations++; return { [Symbol.dispose]: () => { events.push('root'); } };
            } },
            { token: alias, lifetime: ServiceLifetime.Scoped, factory: () => firstScoped }
        ]);
        const scope = registry.createScope(serviceContext('original'));
        try {
            firstScoped = await scope.resolve(scoped);
            const firstRoot = await scope.resolve(root);
            const singletons = registry.singletonScope();
            Object.defineProperties(scope, {
                singleton: { value: true, configurable: true }, registry: { value: {}, configurable: true },
                identity: { value: undefined, configurable: true }
            });
            Object.defineProperties(singletons, {
                singleton: { value: false, configurable: true }, registry: { value: {}, configurable: true },
                identity: { value: serviceContext('forged'), configurable: true }
            });
            sameScoped = await scope.resolve(scoped) === firstScoped;
            sameRoot = await scope.resolve(root) === firstRoot && await singletons.resolve(root) === firstRoot;
            captiveFailure = await captureFailure(Promise.resolve().then(() => singletons.resolve(scoped)));
            const other = registry.createScope(serviceContext('other'));
            aliasFailure = await captureFailure(other.resolve(alias));
            await scope.dispose();
            beforeShutdown = [...events];
            await registry.dispose();
            afterShutdown = [...events];
        } finally { await registry.dispose(); }
    });
    it('should retain private dispatch and reject forged singleton or alias ownership', () => {
        sameScoped.should.equal(true);
        sameRoot.should.equal(true);
        (captiveFailure as Error).message.should.match(/Captive service dependency/);
        (aliasFailure as Error).message.should.match(/Conflicting service ownership/);
        scopedCreations.should.equal(1);
        rootCreations.should.equal(1);
    });
    it('should dispose each owned instance in its owning scope', () => {
        beforeShutdown.should.deep.equal([ServiceLifetime.Scoped]);
        afterShutdown.should.deep.equal([ServiceLifetime.Scoped, 'root']);
    });
});
