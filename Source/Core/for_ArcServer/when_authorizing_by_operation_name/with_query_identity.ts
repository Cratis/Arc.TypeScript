// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineQuery } from '../../queries/defineQuery.js';
import type { QueryContext } from '../../queries/QueryContext.js';
import { unauthorizedQueryResult } from '../../queries/unauthorizedQueryResult.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
should();

const execution = { correlationId: 'query-identity', allowedSeverity: 2, principal: undefined, tenantId: undefined,
    signal: new AbortController().signal };

describe('when authorizing identical queries by declared operation name', () => {
    let server: ArcServer;
    let names: (string | undefined)[];
    let allowed: boolean;
    let denied: boolean;
    let malformed: boolean;
    let spoofed: boolean;
    let immutable: boolean;
    beforeEach(async () => {
        names = [];
        class Gate {
            onPerform(context: QueryContext) {
                names.push(context.operationName);
                if (context.operationName === 'Tasks.Denied') {
                    immutable = Reflect.set(context, 'operationName', 'Tasks.Allowed') === false;
                    try { Object.defineProperty(context, 'operationName', { value: 'Tasks.Allowed' }); immutable = false; }
                    catch { /* The identity is not configurable. */ }
                }
                if (context.operationName !== 'Tasks.Allowed') return unauthorizedQueryResult(context);
            }
        }
        server = new ArcServer({
            services: [{ token: Gate, lifetime: ServiceLifetime.Scoped, factory: () => new Gate() }],
            authorizationQueryFilters: [Gate],
            queries: [
                defineQuery({ name: 'Allowed', namespace: 'Tasks', schema: z.object({}), perform: () => 'yes' }),
                defineQuery({ name: 'Denied', namespace: 'Tasks', schema: z.object({}), perform: () => 'no' })
            ]
        });
        allowed = (await server.performQuery('Tasks.Allowed', {}, execution)).isSuccess;
        denied = (await server.performQuery('Tasks.Denied', {}, execution)).isAuthorized;
        malformed = (await server.performQuery('Tasks.Allowed', 'invalid', execution)).validationResults.length > 0;
        const spoofedExecution = { ...execution, operationName: 'Tasks.Allowed' };
        spoofed = (await server.performQuery('Tasks.Denied', { operationName: 'Tasks.Allowed' },
            spoofedExecution)).isAuthorized;
    });
    afterEach(async () => { await server.dispose(); });
    it('should admit only the named query', () => { allowed.should.equal(true); denied.should.equal(false); });
    it('should match introspection even on malformed input', () => {
        names.should.deep.equal(['Tasks.Allowed', 'Tasks.Denied', 'Tasks.Allowed', 'Tasks.Denied']);
        server.queries.map(item => item.fullyQualifiedName).should.deep.equal(['Tasks.Allowed', 'Tasks.Denied']);
        malformed.should.equal(true);
    });
    it('should not let the caller or the filter replace its name', () => {
        spoofed.should.equal(false);
        immutable.should.equal(true);
    });
});
