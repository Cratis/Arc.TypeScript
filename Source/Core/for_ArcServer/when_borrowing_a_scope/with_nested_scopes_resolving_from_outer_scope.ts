// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, currentContext } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';

should();
describe('when resolving from an outer scope inside a nested borrowed scope', () => {
    let scopedExecution: ExecutionContext;
    let scopedAmbient: ExecutionContext | undefined;
    let transientExecution: ExecutionContext;
    let transientAmbient: ExecutionContext | undefined;
    let innerExecution: ExecutionContext;
    let innerAmbient: ExecutionContext | undefined;
    let outerIdentity: ExecutionContext;
    let innerIdentity: ExecutionContext;
    let ambient: ExecutionContext;
    beforeEach(async () => {
        const scoped = serviceToken<{ execution: ExecutionContext; ambient: ExecutionContext | undefined }>('scoped execution');
        const transient = serviceToken<{ execution: ExecutionContext; ambient: ExecutionContext | undefined }>('transient execution');
        const server = new ArcServer({ services: [
            { token: scoped, lifetime: ServiceLifetime.Scoped, factory: (_scope, execution) => ({ execution, ambient: currentContext() }) },
            { token: transient, lifetime: ServiceLifetime.Transient, factory: (_scope, execution) => ({ execution, ambient: currentContext() }) }
        ] });
        const outerPrincipal = { id: 'outer', roles: ['Reader'], isAuthenticated: true };
        const innerPrincipal = { id: 'inner', roles: ['Writer'], isAuthenticated: true };
        const outer = server.services.createScope({ ...serviceContext('outer'), principal: outerPrincipal,
            correlationId: 'b0f0a604-be5b-4713-b7e5-850570f11275' });
        const inner = server.services.createScope({ ...serviceContext('inner'), principal: innerPrincipal,
            correlationId: 'c0f0a604-be5b-4713-b7e5-850570f11275' });
        outerIdentity = outer.identity!;
        innerIdentity = inner.identity!;
        try {
            await server.runInScope(outer, async () => {
                await server.runInScope(inner, async () => {
                    ambient = currentContext()!;
                    const outerScoped = await outer.resolve(scoped);
                    const outerTransient = await outer.resolve(transient);
                    const innerScoped = await inner.resolve(scoped);
                    scopedExecution = outerScoped.execution;
                    scopedAmbient = outerScoped.ambient;
                    transientExecution = outerTransient.execution;
                    transientAmbient = outerTransient.ambient;
                    innerExecution = innerScoped.execution;
                    innerAmbient = innerScoped.ambient;
                }, { correlationId: 'a0f0a604-be5b-4713-b7e5-850570f11275' });
            });
        } finally { await outer.dispose(); await inner.dispose(); await server.dispose(); }
    });
    it('should give factories resolving from the outer scope its stable authority', () => {
        scopedExecution.should.equal(outerIdentity);
        transientExecution.should.equal(outerIdentity);
        scopedAmbient!.should.equal(outerIdentity);
        transientAmbient!.should.equal(outerIdentity);
        (scopedAmbient!.principal === outerIdentity.principal).should.equal(true);
        (transientAmbient!.principal === outerIdentity.principal).should.equal(true);
        scopedExecution.principal!.id.should.equal('outer');
        scopedExecution.correlationId.should.equal('b0f0a604-be5b-4713-b7e5-850570f11275');
    });
    it('should give factories resolving from the inner scope its own stable authority', () => {
        innerExecution.should.equal(innerIdentity);
        innerAmbient!.should.equal(innerIdentity);
        innerExecution.correlationId.should.equal('c0f0a604-be5b-4713-b7e5-850570f11275');
    });
    it('should expose only the inner invocation override as ambient context', () => {
        ambient.correlationId.should.equal('a0f0a604-be5b-4713-b7e5-850570f11275');
        ambient.principal!.id.should.equal('inner');
        (ambient.principal === innerIdentity.principal).should.equal(false);
        Object.isFrozen(ambient.principal!.roles).should.equal(true);
    });
});
