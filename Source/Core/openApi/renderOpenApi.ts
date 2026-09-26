// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { SortDirection } from '../queries/SortDirection.js';
import type { Operation } from '../http/Operation.js';
import type { ArcOptions } from '../ArcOptions.js';
import { authorizationRequirements } from '../authorization/authorizationRequirements.js';
import { isObservableOperation } from '../queries/observable/ObservableOperation.js';
import { resultSchema } from './resultSchema.js';
import { isJwtBearer } from '../authentication/jwtBearer.js';

const pagingDescriptions: Record<string, string> = {
    page: 'Page number to show', pageSize: 'Number of items to limit a page to',
    sortBy: 'Sort by field name', sortDirection: 'Sort direction'
};

/** Render the GET representation of Arc routes. The QUERY method has no OpenAPI path-item equivalent. */
export function renderOpenApi(commands: readonly Operation[], queries: readonly Operation[], options: ArcOptions = {}): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};
    const named = Object.entries(options.authenticationSchemes ?? {}).filter(([, handler]) => isJwtBearer(handler)).map(([name]) => name);
    const defaultBearer = named.includes('bearer') ? 'arcBearer' : 'bearer';
    const schemes = [...named, ...(options.authentication?.some(isJwtBearer) ? [defaultBearer] : [])];
    for (const operation of [...commands, ...queries]) {
        const observable = isObservableOperation(operation);
        const method = operation.kind === 'command' ? 'post' : 'get';
        const requirements = authorizationRequirements(operation.authorization);
        const explicit = [...new Set(requirements.flatMap(requirement => requirement.schemes ?? []))];
        const protectedRoute = requirements.some(requirement => !requirement.anonymous &&
            (requirement.authenticated || requirement.roles?.length || requirement.schemes?.length || requirement.policy));
        const security = protectedRoute && schemes.length ? explicit.length ? explicit.filter(name => named.includes(name)) :
            options.authentication?.some(isJwtBearer) ? [defaultBearer] : [] : [];
        const response = { description: observable ? 'Snapshot or direct SSE stream' : 'Result', content: {
            'application/json': { schema: resultSchema(operation) },
            ...(observable ? { 'text/event-stream': { schema: { type: 'string' } } } : {})
        } };
        const inputs = Object.entries(operation.inputSchema.properties as Record<string, unknown> ?? {});
        const reserved = new Set(inputs.map(([name]) => name.toLowerCase()));
        const cardinality = operation.generatedReturn?.cardinality;
        // Advertise paging only for declared arrays and queryPage results; unknown returns cannot be inferred safely.
        const paging = cardinality === 'many' || cardinality === 'paged';
        const parameters = operation.kind === 'query' ? [
            ...inputs.map(([name, schema]) =>
                ({ name, in: 'query', required: (operation.inputSchema.required as string[] ?? []).includes(name), schema })),
            ...[
                ...(paging ? [
                    ['page', { type: 'integer', format: 'int32', minimum: 0 }], ['pageSize', { type: 'integer', format: 'int32', minimum: 1 }],
                    ['sortBy', { type: 'string' }],
                    ['sortDirection', { type: 'string',
                        enum: [SortDirection.Ascending, 'ascending', SortDirection.Descending, 'descending'] }]
                ] as const : []),
                ...(observable ? [['waitForFirstResult', { type: 'boolean' }],
                    ['waitForFirstResultTimeout', { type: 'number', exclusiveMinimum: 0, maximum: 120 }]] as const : [])
            ].filter(([name]) => !reserved.has(name.toLowerCase())).map(([name, schema]) => ({ name, in: 'query', required: false,
                ...(pagingDescriptions[name] ? { description: pagingDescriptions[name] } : {}), schema }))
        ] : undefined;
        const operationId = operation.fullyQualifiedName;
        paths[operation.route] ??= {};
        const tags = [operation.routeNamespace ?? operation.namespace ?? operation.name];
        const securityRequirements = security.length ? { security: security.map(name => ({ [name]: [] })) } : {};
        // Named handlers only run on routes that select them; default handlers run even on anonymous routes;
        // a host-supplied native principal can only produce 401 on protected routes.
        const canAuthenticate = !!(options.authentication?.length || explicit.length || (options.nativePrincipal && protectedRoute));
        const unauthenticated = canAuthenticate ? { '401': { description: 'Unauthenticated',
            content: { 'application/json': { schema: resultSchema(operation, false) } } } } : {};
        const requestBody = { required: true, content: { 'application/json': { schema: operation.inputSchema } } };
        paths[operation.route]![method] = {
            operationId, tags,
            summary: operation.summary ?? '',
            ...securityRequirements,
            ...(operation.kind === 'command' ? { requestBody } : { parameters }),
            responses: { '200': response,
                ...(observable ? { '202': { description: 'No current value', content: { 'application/json': { schema: resultSchema(operation, false) } } },
                    '408': { description: 'First-result wait timed out', content: { 'application/json': { schema: resultSchema(operation, false) } } },
                    '503': { description: 'Subscription limit reached', content: { 'application/json': { schema: resultSchema(operation, false) } } } } : {}),
                '400': { description: 'Invalid request', content: { 'application/json': { schema: resultSchema(operation, false) } } },
                ...unauthenticated,
                '403': { description: 'Not authorized', content: { 'application/json': { schema: resultSchema(operation, false) } } },
                '500': { description: 'Server error', content: { 'application/json': { schema: resultSchema(operation, false) } } } }
        };
        if (operation.kind === 'command') {
            (paths[operation.route + '/validate'] ??= {}).post = {
                operationId: `${operationId}:validate`, tags,
                summary: `Validate ${operation.name} without executing it`,
                ...securityRequirements, requestBody,
                responses: Object.fromEntries(['200', '400', ...(canAuthenticate ? ['401'] : []), '403', '500'].map(code => [code, {
                    description: code === '200' ? 'Result' : code === '400' ? 'Invalid request' :
                        code === '401' ? 'Unauthenticated' : code === '403' ? 'Not authorized' : 'Server error',
                    content: { 'application/json': { schema: resultSchema(operation, false) } }
                }]))
            };
        }
    }
    return { openapi: '3.1.0', info: { title: 'Arc', version: options.generatedApis?.openApiVersion ?? '0.1.0' },
        ...(schemes.length ? { components: { securitySchemes: Object.fromEntries(schemes.map(name => [name,
            { type: 'http', scheme: 'bearer' }])) } } : {}), paths };
}
