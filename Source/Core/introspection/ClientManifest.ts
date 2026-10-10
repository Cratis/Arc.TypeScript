// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ClientAuthentication } from './ClientAuthentication.js';
import { ClientOperationKind } from './ClientOperationKind.js';
import type { ArcServer } from '../ArcServer.js';
import type { Authorization } from '../authorization/Authorization.js';
import { authorizationRequirements } from '../authorization/authorizationRequirements.js';
import type { ClientOperation } from './ClientOperation.js';
import type { ExportedOperation } from './ExportedOperation.js';
import { inspectClientInput } from './inspectClientInput.js';
import { fail, hasOnlyKeys, plain } from './manifestGuards.js';
import { parseClientOperation, sortOperations } from './parseClientOperation.js';

export { assertClientOutput } from './assertClientOutput.js';
export { inspectClientInput, inspectClientQueryInput } from './inspectClientInput.js';

export interface ClientManifest {
    product: '@cratis/arc.core';
    version: 1;
    operations: readonly ClientOperation[];
}

const isManifestRoot = (value: unknown): value is { operations: unknown[] } =>
    plain(value) && value.product === '@cratis/arc.core' && value.version === 1 && Array.isArray(value.operations) &&
    value.operations.length > 0 && value.operations.length <= 1024 && hasOnlyKeys(value, ['product', 'version', 'operations']);

/** Tracks IDs, routes and generated symbols already claimed so collisions can be rejected. */
class OperationRegistry {
    readonly #ids = new Set<string>();
    readonly #routes = new Set<string>();
    readonly #symbols = new Set<string>();

    register(operation: ClientOperation): void {
        const id = operation.id.toLowerCase();
        const route = operation.route.toLowerCase();
        const symbol = operation.id.split('.').join('_').toLowerCase();
        if (this.#collides(operation, id, route, symbol)) fail(operation.id, 'duplicate ID, generated symbol or route');
        this.#ids.add(id); this.#symbols.add(symbol); this.#routes.add(route);
        if (operation.kind === ClientOperationKind.Command) this.#routes.add(`${route}/validate`);
    }

    #collides(operation: ClientOperation, id: string, route: string, symbol: string): boolean {
        return this.#ids.has(id) || this.#routes.has(route) || this.#symbols.has(symbol) || this.#routes.has(`${route}/validate`) ||
            operation.kind === ClientOperationKind.Command && this.#routes.has(route.replace(/\/validate$/, ''));
    }
}

/** Parse untrusted JSON without trusting prototypes, aliases, unsupported shapes or version drift. */
export function validateClientManifest(value: unknown): ClientManifest {
    if (!isManifestRoot(value)) fail('root', 'unsupported product, version or structure');
    const operations = value.operations.map(parseClientOperation);
    // Measure only the sanitized copy: never serialize the caller's objects or execute toJSON.
    if (JSON.stringify(operations).length > 1024 * 1024) fail('root', 'manifest exceeds 1 MiB');
    const registry = new OperationRegistry();
    for (const operation of operations) registry.register(operation);
    return { product: '@cratis/arc.core', version: 1, operations: sortOperations(operations) };
}

const requiresAuthentication = (authorization: Authorization): boolean =>
    Boolean(authorization.authenticated || authorization.requirements?.some(requirement =>
        requirement.authenticated || requirement.roles?.length || requirement.policy || requirement.schemes?.length) ||
        authorization.roles?.length || authorization.policy || authorization.schemes?.length);

function authenticationOf(authorization: Authorization | undefined): ClientAuthentication {
    if (authorization?.anonymous) return ClientAuthentication.Anonymous;
    return authorization && requiresAuthentication(authorization) ? ClientAuthentication.Authenticated : ClientAuthentication.Default;
}

const kindOf = (operation: ExportedOperation): ClientOperationKind =>
    'observable' in operation && operation.observable === true ? ClientOperationKind.Observable : operation.kind;

function exportOperation(server: ArcServer, operation: ExportedOperation) {
    const id = operation.fullyQualifiedName;
    if (!operation.clientOutput) fail(id, 'missing explicit client output metadata');
    const input = inspectClientInput(operation.schema, id);
    return {
        id, kind: kindOf(operation),
        route: operation.route,
        methods: server.endpoints.get(operation.route)?.split(', ') ?? [],
        ...(operation.kind === 'query' ? { queryName: id } : {}),
        roles: [...new Set(authorizationRequirements(operation.authorization)
            .flatMap(requirement => requirement.roles ?? []))],
        authentication: authenticationOf(operation.authorization),
        dynamicAuthorization: operation.dynamicAuthorization === true,
        input, output: operation.clientOutput.output
    };
}

/** No handler, validator, authorization callback, service factory or Zod default is invoked by export. */
export function exportClientManifest(server: ArcServer): ClientManifest {
    const operations = [...server.commands, ...server.queries].filter(operation => !operation.internal)
        .map(operation => exportOperation(server, operation));
    return validateClientManifest({ product: '@cratis/arc.core', version: 1, operations });
}
