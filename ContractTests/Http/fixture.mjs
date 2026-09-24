// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import express from 'express';
import { z } from 'zod';
import { ArcApplication, AuthenticationStatus, CurrentValueSubject, defineCommand, defineObservableQuery, defineQuery, rejected, tuple, validation } from '@cratis/arc.core';
import { ModelBoundCommand } from './modelBound/dist/ModelBoundCommand.js';
import { ModelBoundCommandValidator } from './modelBound/dist/ModelBoundCommandValidator.js';
import { ModelBoundTitle } from './modelBound/dist/ModelBoundTitle.js';
import { ModelBoundLookup } from './modelBound/dist/ModelBoundLookup.js';
import { ValidationGraphCommand } from './modelBound/dist/ValidationGraphCommand.js';
import { FixtureRateValidator } from './modelBound/dist/FixtureRateValidator.js';
import { GuidCommand } from './modelBound/dist/GuidCommand.js';
import { GuidCommandValidator } from './modelBound/dist/GuidCommandValidator.js';
import { HttpMetric } from './modelBound/dist/HttpMetric.js';
import { PolicyItems, RateLookup } from './modelBound/dist/PolicyAndObservable.js';
import { mountExpress } from '@cratis/arc.express';

let executions = 0;
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
    perform: () => [...items]
});
const privateItems = defineQuery({
    name: 'Private', namespace: 'FixtureItem', path: '/api/items/private', schema: z.object({}), authorization: admin,
    perform: () => [...items]
});
const currentStream = defineObservableQuery({
    name: 'Current', namespace: 'FixtureStream', path: '/api/fixture-stream/current', schema: z.object({}), authorization: anonymous,
    observe: () => CurrentValueSubject.of({ value: 'ready' })
});
const pendingStream = defineObservableQuery({
    name: 'Pending', namespace: 'FixtureStream', path: '/api/fixture-stream/pending', schema: z.object({}), authorization: anonymous,
    observe: () => new CurrentValueSubject()
});
const authentication = request => {
    const role = request.headers.get('X-Fixture-Role');
    if (role === null) return { status: AuthenticationStatus.Anonymous };
    if (role !== 'Reader' && role !== 'Admin') return { status: AuthenticationStatus.Failed };
    return { status: AuthenticationStatus.Authenticated, principal: {
        id: 'fixture-user', roles: [role], isAuthenticated: true
    } };
};
const builder = ArcApplication.createBuilder({
    commands: [echo, adminEcho, policyEcho, throwFailure, tupleEcho, echoMetric], queries: [echoCount, byId, all, privateItems],
    observableQueries: [currentStream, pendingStream], authentication: [authentication], development: false, segmentsToSkip: 1
});
builder.add(ModelBoundCommand, ModelBoundCommandValidator, ModelBoundTitle, ModelBoundLookup,
    ValidationGraphCommand, FixtureRateValidator, GuidCommand, GuidCommandValidator, HttpMetric,
    PolicyItems, RateLookup);
builder.addAuthorizationPolicy('FixtureAdmin', principal => principal.roles.includes('Admin'));
const arc = await builder.build();
const app = express();
mountExpress(app, arc);
const server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    console.log(JSON.stringify({ kind: 'typescript-http-fixture-ready', baseUrl: `http://127.0.0.1:${address.port}` }));
});
server.on('error', error => { console.error(error); process.exitCode = 1; });
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close());
