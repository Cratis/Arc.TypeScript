// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, currentContext } from '../../ArcServer.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { Severity } from '../../validation/Severity.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';

should();
describe('when borrowing a scope after its original authority is mutated', () => {
    let observed: ReturnType<typeof currentContext>;
    let factoryContext: ReturnType<typeof currentContext>;
    let factoryAuthority: ExecutionContext;
    let matchesScope: boolean;
    let originalSignal: AbortSignal;
    beforeEach(async () => {
        const authority = serviceToken<ExecutionContext>('factory authority');
        const server = new ArcServer({ services: [
            { token: authority, lifetime: ServiceLifetime.Scoped, factory: (_scope, execution) => execution }
        ] });
        const principal = { id: 'original', roles: ['Reader'], isAuthenticated: true, scheme: 'Verified',
            claims: { group: { name: 'before' } } };
        const context = { correlationId: 'initial', tenantId: 'first', principal, connectionId: 'connection',
            remoteAddress: 'local', signal: new AbortController().signal, allowedSeverity: Severity.Warning };
        originalSignal = context.signal;
        const scope = server.services.createScope(context);
        context.tenantId = 'second';
        context.connectionId = 'other';
        context.remoteAddress = 'remote';
        context.allowedSeverity = Severity.Error;
        context.signal = new AbortController().signal;
        principal.id = 'changed';
        principal.scheme = 'Other';
        principal.roles.push('Admin');
        principal.claims.group.name = 'after';
        try {
            observed = await server.runInScope(scope, async () => {
                matchesScope = currentServices() === scope;
                await Promise.resolve();
                factoryContext = currentContext();
                factoryAuthority = await currentServices().resolve(authority);
                return currentContext();
            }, { correlationId: 'invocation' });
        } finally { await scope.dispose(); await server.dispose(); }
    });
    it('should retain the scope tenant and transport authority', () => {
        observed!.tenantId!.should.equal('first');
        observed!.connectionId!.should.equal('connection');
        observed!.remoteAddress!.should.equal('local');
        observed!.allowedSeverity.should.equal(Severity.Warning);
        observed!.signal.should.equal(originalSignal);
    });
    it('should retain the principal identity roles and claims', () => {
        observed!.principal!.id.should.equal('original');
        observed!.principal!.scheme!.should.equal('Verified');
        observed!.principal!.roles.should.deep.equal(['Reader']);
        factoryAuthority.principal!.roles.should.deep.equal(['Reader']);
        factoryAuthority.correlationId.should.equal('initial');
        (observed!.principal!.claims as object).should.deep.equal({ group: { name: 'before' } });
    });
    it('should expose only the invocation correlation and the borrowed services', () => {
        observed!.correlationId.should.equal('invocation');
        (factoryContext === observed).should.equal(true);
        matchesScope.should.equal(true);
    });
});
