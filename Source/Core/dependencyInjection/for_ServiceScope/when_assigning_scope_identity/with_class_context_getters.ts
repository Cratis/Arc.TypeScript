// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ServiceRegistry } from '../../ServiceRegistry.js';
import { ServiceLifetime } from '../../ServiceLifetime.js';
import { serviceToken } from '../../ServiceToken.js';
import { Severity } from '../../../validation/Severity.js';
import type { ExecutionContext } from '../../../execution/ExecutionContext.js';
import type { Principal } from '../../../identity/Principal.js';

should();
describe('when creating a scope from a class-based execution context', () => {
    let observed: ExecutionContext;
    let scopeContext: ExecutionContext;
    let principal: Principal;
    let originalSignal: AbortSignal;
    beforeEach(async () => {
        const token = serviceToken<ExecutionContext>('execution');
        const registry = new ServiceRegistry([
            { token, lifetime: ServiceLifetime.Scoped, factory: (_scope, execution) => execution }
        ]);
        principal = { id: 'user', roles: ['Reader'], isAuthenticated: true };
        class Context implements ExecutionContext {
            tenant = 'first';
            cancellation = new AbortController().signal;
            readonly correlationId = 'original';
            readonly principal = principal;
            readonly allowedSeverity = Severity.Warning;
            get tenantId(): string { return this.tenant; }
            get signal(): AbortSignal { return this.cancellation; }
        }
        const context = new Context();
        originalSignal = context.signal;
        const scope = registry.createScope(context);
        context.tenant = 'second';
        context.cancellation = new AbortController().signal;
        try {
            scopeContext = scope.identity!;
            observed = await scope.resolve(token);
        } finally { await scope.dispose(); await registry.dispose(); }
    });
    it('should capture inherited tenant and signal getters at creation', () => {
        scopeContext.tenantId!.should.equal('first');
        scopeContext.signal.should.equal(originalSignal);
        observed.tenantId!.should.equal('first');
        observed.signal.should.equal(originalSignal);
        Object.isFrozen(scopeContext).should.equal(true);
    });
    it('should retain the original principal reference for ordinary factories', () => {
        (scopeContext.principal === principal).should.equal(true);
        (observed.principal === principal).should.equal(true);
    });
});
