// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import express from 'express';
import fastify from 'fastify';
import { Hono } from 'hono';
import { z } from 'zod';
import { ArcApplication, AuthenticationStatus, CurrentValueSubject, currentContext, defineCommand, defineObservableQuery,
    defineQuery, rejected, tuple, validation } from '@cratis/arc.core';
import { ModelBoundCommand } from './modelBound/dist/ModelBoundCommand.js';
import { FilterParityCommand } from './modelBound/dist/FilterParityCommand.js';
import { FilterParityCommandValidator } from './modelBound/dist/FilterParityCommandValidator.js';
import { FilterParityAuthorizationFilter } from './modelBound/dist/FilterParityAuthorizationFilter.js';
import { FilterParityQueryAuthorizationFilter } from './modelBound/dist/FilterParityQueryAuthorizationFilter.js';
import { FilterParityOrdinaryCommandFilter, FilterParityOrdinaryQueryFilter } from './modelBound/dist/FilterParityOrdinaryFilters.js';
import { filterParityEvents, recordFilterParity } from './modelBound/dist/FilterParityObservations.js';
import { ModelBoundCommandValidator } from './modelBound/dist/ModelBoundCommandValidator.js';
import { ModelBoundTitle } from './modelBound/dist/ModelBoundTitle.js';
import { ModelBoundLookup } from './modelBound/dist/ModelBoundLookup.js';
import { ValidationGraphCommand } from './modelBound/dist/ValidationGraphCommand.js';
import { FixtureRateValidator } from './modelBound/dist/FixtureRateValidator.js';
import { GuidCommand } from './modelBound/dist/GuidCommand.js';
import { GuidCommandValidator } from './modelBound/dist/GuidCommandValidator.js';
import { HttpMetric } from './modelBound/dist/HttpMetric.js';
import { PolicyItems, RateLookup } from './modelBound/dist/PolicyAndObservable.js';
import { AnonymousClassCases, AuthorizationOverride, MethodRoleCases, RoleCases } from './modelBound/dist/AuthorizationCases.js';
import { cratisArc as expressArc } from '@cratis/arc.express';
import { cratisArc as fastifyArc } from '@cratis/arc.fastify';
import { cratisArc as honoArc, serveCratisArc } from '@cratis/arc.hono';

let executions = 0;
let queryExecutions = 0;
let inputCaseExecutions = 0;
let queryCaseExecutions = 0;
const items = Object.freeze([{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }, { id: 3, name: 'Linus' }]);
const valueSchema = z.object({ value: z.string() });
const anonymous = { anonymous: true };
const admin = { roles: ['Admin'] };
const echo = defineCommand({
    name: 'EchoValue', path: '/api/echo-value', schema: valueSchema, authorization: anonymous,
    validate: ({ value }) => value ? [] : [validation('Value is required', ['value'])],
    handle: ({ value }) => { executions++; return { value }; }
});
const adminEcho = defineCommand({
    name: 'AdminEcho', path: '/api/admin-echo', schema: valueSchema, authorization: admin,
    validate: ({ value }) => value ? [] : [validation('Value is required', ['value'])],
    handle: ({ value }) => ({ value })
});
const policyEcho = defineCommand({
    name: 'PolicyEcho', path: '/api/policy-echo', schema: valueSchema,
    authorization: { policy: 'FixtureAdmin', authenticated: true },
    validate: ({ value }) => value ? [] : [validation('Value is required', ['value'])],
    handle: ({ value }) => ({ value })
});
const tupleEcho = defineCommand({
    name: 'TupleEcho', path: '/api/tuple-echo', schema: valueSchema, authorization: anonymous,
    handle: ({ value }) => tuple({ value }, rejected(validation('Cannot echo', ['value'])))
});
const echoMetric = defineCommand({
    name: 'EchoMetric', path: '/api/echo-metric', schema: z.object({
        value: z.union([z.number(), z.literal('NaN'), z.literal('Infinity'), z.literal('-Infinity')])
    }), authorization: anonymous,
    handle: ({ value }) => ({ value: Number(value) })
});
const throwFailure = defineCommand({
    name: 'ThrowFailure', path: '/api/throw-failure', schema: z.object({}), authorization: anonymous,
    handle: () => { throw new Error('Private fixture failure detail'); }
});
const inputCases = defineCommand({
    name: 'InputCases', path: '/api/input-cases', authorization: anonymous,
    schema: z.object({ count: z.number().int().min(-2147483648).max(2147483647),
        state: z.union([z.literal(0), z.literal(1)]), rate: z.number() }),
    validate: ({ rate }) => rate > 0 ? [] : [validation('Rate must be positive', ['rate'])],
    handle: ({ count }) => { inputCaseExecutions++; return count; }
});
const inputCaseCount = defineQuery({
    name: 'Current', namespace: 'InputCaseCount', path: '/api/input-case-count', schema: z.object({}), authorization: anonymous,
    perform: () => ({ count: inputCaseExecutions })
});
const queryCaseCount = defineQuery({
    name: 'Current', namespace: 'QueryCaseCount', path: '/api/query-case-count', schema: z.object({}), authorization: anonymous,
    perform: () => ({ count: queryCaseExecutions })
});
const queryCase = defineQuery({
    name: 'Find', namespace: 'QueryCase', path: '/api/query-case/find', schema: z.object({ value: z.string() }),
    authorization: anonymous,
    validate: ({ value }) => value ? [] : [validation('Value is required', ['value'])],
    perform: ({ value }) => { queryCaseExecutions++; return { value }; }
});
class FilterParityValidatorDependency {
    constructor() { recordFilterParity('query validator dependency constructed'); }
}
class FilterParityPerformerDependency {
    constructor() { recordFilterParity('query performer dependency constructed'); }
}
const filterParityObservations = defineQuery({
    name: 'Current', namespace: 'FilterParityObservations', path: '/api/filter-parity-observations',
    schema: z.object({}), authorization: anonymous, perform: () => ({ events: [...filterParityEvents] })
});
const filterParityQuery = defineQuery({
    name: 'Find', namespace: 'FilterParityQuery', path: '/api/filter-parity-query', schema: valueSchema,
    authorization: anonymous, validatorDependencies: [FilterParityValidatorDependency],
    handlerDependencies: [FilterParityPerformerDependency],
    validate: ({ value }) => { recordFilterParity('query validator', value);
        return value.endsWith('invalid') ? [validation('Value is invalid', ['value'])] : []; },
    perform: ({ value }) => { recordFilterParity('query performer', value); return { value }; }
});
const throwingQuery = defineQuery({
    name: 'Fail', namespace: 'QueryCase', path: '/api/query-case/fail', schema: z.object({}), authorization: anonymous,
    perform: () => { throw new Error('Private fixture failure detail'); }
});
const echoCount = defineQuery({
    name: 'Current', namespace: 'EchoCount', path: '/api/echo-count', schema: z.object({}), authorization: anonymous,
    perform: () => ({ count: executions })
});
const byId = defineQuery({
    name: 'ById', namespace: 'FixtureItem', path: '/api/items/by-id', schema: z.object({ id: z.number().int() }), authorization: anonymous,
    perform: ({ id }) => items.find(item => item.id === id) ?? null
});
const all = defineQuery({
    name: 'All', namespace: 'FixtureItem', path: '/api/items', schema: z.object({}), authorization: anonymous,
    perform: () => { queryExecutions++; return [...items]; }
});
const tenantEcho = defineQuery({
    name: 'Current', namespace: 'TenantEcho', path: '/api/tenant-echo', schema: z.object({}), authorization: anonymous,
    perform: () => ({ tenantId: currentContext()?.tenantId ?? '[NotSet]' })
});
const queryCount = defineQuery({
    name: 'Current', namespace: 'QueryCount', path: '/api/query-count', schema: z.object({}), authorization: anonymous,
    perform: () => ({ count: queryExecutions })
});
const privateItems = defineQuery({
    name: 'Private', namespace: 'FixtureItem', path: '/api/items/private', schema: z.object({}), authorization: admin,
    perform: () => [...items]
});
const currentStream = defineObservableQuery({
    name: 'Current', namespace: 'FixtureStream', path: '/api/fixture-stream/current', schema: z.object({}), authorization: anonymous,
    observe: () => CurrentValueSubject.of({ value: 'ready' })
});
const filterParityStream = defineObservableQuery({
    name: 'Current', namespace: 'FilterParityStream', path: '/api/filter-parity-stream', schema: valueSchema,
    authorization: anonymous, observe: ({ value }) => {
        recordFilterParity('query observer', value);
        return CurrentValueSubject.of({ value });
    }
});
const pendingStream = defineObservableQuery({
    name: 'Pending', namespace: 'FixtureStream', path: '/api/fixture-stream/pending', schema: z.object({}), authorization: anonymous,
    observe: () => new CurrentValueSubject()
});
const tenancyMode = process.env.ARC_FIXTURE_TENANCY;
const tenancy = tenancyMode === 'fixed' ? { resolverType: 'fixed', fixedTenantId: 'fixed-tenant' } :
    tenancyMode === 'claim' ? { resolverType: 'claim' } :
        tenancyMode === 'subdomain' ? { resolverType: 'subdomain', baseDomain: 'example.test' } : undefined;
const delayedStream = defineObservableQuery({
    name: 'First', namespace: 'FixtureStream', path: '/api/fixture-stream/first', schema: z.object({}), authorization: anonymous,
    observe: () => {
        const subject = CurrentValueSubject.pending();
        setTimeout(() => { subject.next({ value: 'first' }); subject.complete(); }, 150);
        return subject;
    }
});
const completedStream = defineObservableQuery({
    name: 'Completed', namespace: 'FixtureStream', path: '/api/fixture-stream/completed', schema: z.object({}), authorization: anonymous,
    observe: () => {
        const subject = CurrentValueSubject.pending();
        setTimeout(() => subject.complete(), 80);
        return subject;
    }
});
const authentication = request => {
    const role = request.headers.get('X-Fixture-Role');
    if (role === null) return { status: AuthenticationStatus.Anonymous };
    if (role !== 'Reader' && role !== 'Admin') return { status: AuthenticationStatus.Failed };
    return { status: AuthenticationStatus.Authenticated, principal: {
        id: 'fixture-user', name: 'fixture-user', roles: [role], isAuthenticated: true,
        claims: { sub: 'fixture-user', tenant_id: 'claim-tenant' }
    } };
};
const builder = ArcApplication.createBuilder({
    commands: [echo, adminEcho, policyEcho, throwFailure, tupleEcho, echoMetric, inputCases],
    queries: [echoCount, queryCount, tenantEcho, inputCaseCount, queryCaseCount, queryCase, filterParityQuery, filterParityObservations, throwingQuery,
        byId, all, privateItems], tenancy,
    observableQueries: [currentStream, filterParityStream, pendingStream, delayedStream, completedStream], authentication: [authentication], development: false,
    identityDetails: { schema: z.object({ greeting: z.string() }), provide: principal =>
        principal.roles.includes('Admin') ? { greeting: 'Hello fixture-user' } : undefined },
    generatedApis: { segmentsToSkipForRoute: 1 }
});
builder.add(FilterParityCommand, FilterParityCommandValidator, FilterParityAuthorizationFilter,
    FilterParityQueryAuthorizationFilter,
    ModelBoundCommand, ModelBoundCommandValidator, ModelBoundTitle, ModelBoundLookup,
    ValidationGraphCommand, FixtureRateValidator, GuidCommand, GuidCommandValidator, HttpMetric,
    PolicyItems, RateLookup, AnonymousClassCases, AuthorizationOverride, MethodRoleCases, RoleCases);
builder.services.addScoped(FilterParityValidatorDependency).addScoped(FilterParityPerformerDependency)
    .addScoped(FilterParityOrdinaryCommandFilter).addScoped(FilterParityOrdinaryQueryFilter);
// Deliberately register ordinary filters first to pin authorization-first execution order.
builder.addCommandPipelineFilter(FilterParityOrdinaryCommandFilter)
    .addQueryPipelineFilter(FilterParityOrdinaryQueryFilter);
builder.addAuthorizationPolicy('FixtureAdmin', principal => principal.roles.includes('Admin'));
const arc = await builder.build();
const adapter = process.env.ARC_FIXTURE_ADAPTER ?? 'express';
let port;
let close;
if (adapter === 'express') {
    const app = express();
    // The loopback fixture explicitly trusts only this test authority; ordinary request Host headers are not tenant credentials.
    const middleware = expressArc(arc, request => ({ authority: tenancyMode === 'subdomain' && request.headers.host === 'acme.example.test'
        ? 'acme.example.test' : undefined }));
    app.use(middleware);
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const disposeSockets = middleware.injectWebSocket(server);
    port = server.address().port;
    close = async () => { await disposeSockets(); await new Promise(resolve => server.close(resolve)); };
} else if (adapter === 'fastify') {
    const app = fastify();
    await app.register(fastifyArc, { arc, webSockets: true });
    await app.listen({ host: '127.0.0.1', port: 0 });
    port = new URL(app.listeningOrigin).port;
    close = () => app.close();
} else if (adapter === 'hono') {
    const app = new Hono();
    app.use(honoArc(arc));
    const hosted = await serveCratisArc(app, arc, { port: 0, hostname: '127.0.0.1' });
    port = hosted.server.address().port;
    close = () => hosted.dispose();
} else throw new Error(`Unknown fixture adapter: ${adapter}`);
console.log(JSON.stringify({ kind: 'typescript-http-fixture-ready', baseUrl: `http://127.0.0.1:${port}`, adapter }));
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void close().catch(error => {
    console.error(error); process.exitCode = 1;
}); });
