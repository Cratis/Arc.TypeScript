// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, currentContext } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { defineQuery } from '../../queries/defineQuery.js';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';

should();
describe('when constructing services during an ordinary query', () => {
    let factoryContexts: { execution: ExecutionContext; ambient: ExecutionContext | undefined; scope: ExecutionContext | undefined }[];
    let handlerContext: ExecutionContext | undefined;
    let principal: ExecutionContext['principal'];
    let success: boolean;
    beforeEach(async () => {
        factoryContexts = [];
        principal = { id: 'caller', roles: ['Reader'], isAuthenticated: true };
        const scoped = serviceToken<object>('scoped');
        const transient = serviceToken<object>('transient');
        const factory = (_scope: unknown, execution: ExecutionContext) => {
            factoryContexts.push({ execution, ambient: currentContext(), scope: currentServices().identity });
            return {};
        };
        const server = new ArcServer({ services: [
            { token: scoped, lifetime: ServiceLifetime.Scoped, factory },
            { token: transient, lifetime: ServiceLifetime.Transient, factory }
        ], queries: [defineQuery({ name: 'FactoryContext', schema: z.object({}), handlerDependencies: [scoped, transient],
            perform: () => { handlerContext = currentContext(); return 'done'; } })] });
        try {
            const result = await server.performQuery('FactoryContext', {}, { ...serviceContext('tenant'), principal });
            success = result.isSuccess;
        } finally { await server.dispose(); }
    });
    it('should give both factories the scope snapshot and original principal', () => {
        success.should.equal(true);
        factoryContexts.should.have.lengthOf(2);
        for (const { execution, ambient, scope } of factoryContexts) {
            ambient!.should.equal(scope);
            ambient!.should.equal(execution);
            (ambient!.principal === principal).should.equal(true);
            ambient!.tenantId!.should.equal('tenant');
        }
    });
    it('should restore the ordinary request context for the handler', () => {
        handlerContext!.tenantId!.should.equal('tenant');
        (handlerContext!.principal === principal).should.equal(true);
    });
});
