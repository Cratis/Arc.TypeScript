// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { ArcServerOptions } from '../ArcServerOptions.js';
import type { Operation } from './Operation.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { ObservableSource } from '../queries/observable/ObservableSource.js';
import type { QueryHealthSnapshot } from '../queries/observable/QueryHealthSnapshot.js';
import { inspectClientInput, inspectClientQueryInput } from '../introspection/ClientManifest.js';
import { commandOperation } from '../commands/commandOperation.js';
import { queryOperation } from '../queries/queryOperation.js';
import { observableOperation } from '../queries/observable/ObservableOperation.js';

function routeFor(operation: { namespace?: string; routeNamespace?: string; name: string; path?: string }, prefix: string, skip: number, includeName: boolean): string {
    const location = operation.routeNamespace ?? operation.namespace;
    const segments = location ? location.split('.') : [];
    for (const segment of [...segments, operation.name]) if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(segment)) throw new Error('Unsafe Arc name');
    if (operation.path) {
        if (!/^\/(?!\/)[a-zA-Z0-9/_-]+\/?$/.test(operation.path) || operation.path.includes('..')) throw new Error('Unsafe Arc path');
        return operation.path.replace(/\/$/, '') || '/';
    }
    const kebab = (value: string): string => value.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();
    return '/' + [prefix, ...segments.slice(skip).map(kebab), ...(includeName ? [kebab(operation.name)] : [])].filter(Boolean).join('/');
}
export function createRouteTable(options: ArcServerOptions, observeHealth: (context: ExecutionContext) => ObservableSource<QueryHealthSnapshot>): {
    commands: readonly Operation[]; queries: readonly Operation[]; routes: ReadonlyMap<string, Operation>; endpoints: ReadonlyMap<string, string>
} {
        const prefix = options.generatedApis?.routePrefix ?? options.prefix ?? 'api';
        if (prefix && !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(prefix)) throw new Error('Unsafe Arc prefix');
        const skip = options.generatedApis?.segmentsToSkipForRoute ?? options.segmentsToSkip ?? 0;
        if (!Number.isSafeInteger(skip) || skip < 0) throw new Error('Invalid namespace segments to skip');
        for (const item of [...options.commands ?? [], ...options.queries ?? [], ...options.observableQueries ?? []]) {
            if (item.clientOutput) {
                const id = [item.namespace, item.name].filter(Boolean).join('.');
                if (options.queries?.some(query => query === item) || options.observableQueries?.some(query => query === item))
                    inspectClientQueryInput(item.schema, id);
                inspectClientInput(item.schema, id);
            }
            if (item.authorization?.anonymous && (item.authorization.authenticated || item.authorization.roles?.length))
                throw new Error(`Conflicting Arc authorization: ${item.name}`);
            if (item.schema instanceof z.ZodObject) {
                const folded = Object.keys(item.schema.shape).map(key => key.toLowerCase());
                if (new Set(folded).size !== folded.length) throw new Error(`Ambiguous Arc argument names: ${item.name}`);
            }
        }
        const includeName = (item: { namespace?: string; routeNamespace?: string }, items: readonly { namespace?: string; routeNamespace?: string }[], configured?: boolean): boolean =>
            configured !== false || items.filter(other => (other.routeNamespace ?? other.namespace ?? '').split('.').slice(skip).join('.') ===
                (item.routeNamespace ?? item.namespace ?? '').split('.').slice(skip).join('.')).length > 1;
        const includeCommandName = options.generatedApis?.includeCommandNameInRoute ?? options.includeCommandNameInRoute;
        const includeQueryName = options.generatedApis?.includeQueryNameInRoute ?? options.includeQueryNameInRoute;
        const commandDefinitions = options.commands ?? [];
        const queryDefinitions = [...options.queries ?? [], ...options.observableQueries ?? []];
        const commands = commandDefinitions.map(item => commandOperation(item, routeFor(item, prefix, skip,
            includeName(item, commandDefinitions, includeCommandName)), options));
        const queries = [
            ...(options.queries ?? []).map(item => queryOperation(item, routeFor(item, prefix, skip,
                includeName(item, queryDefinitions, includeQueryName)))),
            ...(options.observableQueries ?? []).map(item => observableOperation(item, routeFor(item, prefix, skip,
                includeName(item, queryDefinitions, includeQueryName)))),
            ...(options.enableObservableHealth ? [{ ...observableOperation({
                name: 'ObserveHealth', namespace: 'QueryHealth', path: '/.cratis/queries/health',
                schema: z.object({}), authorization: { authenticated: true },
                observe: (_input, context) => observeHealth(context)
            }, '/.cratis/queries/health'), internal: true }] : [])
        ];
        const routes = new Map<string, Operation>();
        const names = new Set<string>();
        const endpoints = new Map<string, string>([
            ['/.cratis/commands', 'GET'], ['/.cratis/queries', 'GET'],
            ['/.cratis/identity-details/schema', 'GET'], ['/.cratis/users', 'GET'],
            ['/.cratis/tenants', 'GET'], ['/openapi.json', 'GET'],
            ['/.cratis/queries/ws', 'GET'], ['/.cratis/queries/sse', 'GET'],
            ['/.cratis/queries/sse/subscribe', 'POST'], ['/.cratis/queries/sse/unsubscribe', 'POST']
        ]);
        if (options.identityDetails) endpoints.set('/.cratis/me', 'GET');
        const reserved = new Set([...endpoints.keys(), '/.cratis/me']);
        for (const operation of [...commands, ...queries]) {
            const name = `${operation.namespace ?? ''}.${operation.name}`.toLowerCase();
            if (names.has(name)) throw new Error(`Duplicate Arc operation: ${name}`);
            names.add(name);
            if (routes.has(operation.route) || reserved.has(operation.route) ||
                (operation.kind === 'command' && (routes.has(operation.route + '/validate') || reserved.has(operation.route + '/validate'))))
                throw new Error(`Duplicate Arc route: ${operation.route}`);
            routes.set(operation.route, operation);
            endpoints.set(operation.route, operation.kind === 'command' ? 'POST' : options.enableQueryMethod === false ? 'GET' : 'GET, QUERY');
            if (operation.kind === 'command') {
                routes.set(operation.route + '/validate', operation);
                endpoints.set(operation.route + '/validate', 'POST');
            }
        }
    return { commands, queries, routes, endpoints };
}
