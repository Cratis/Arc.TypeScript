// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../ArcServer.js';
import type { RequestBindings } from './handleRequest.js';
import type { EndpointResponse } from './EndpointResponse.js';

/** Serve the generated API listings, OpenAPI schema and identity-details schema. */
export function handleIntrospection(server: ArcServer, bindings: RequestBindings, path: string, response: EndpointResponse): Response {
    if (path === '/.cratis/identity-details/schema') return response.send(bindings.identitySchema ?? {}, 200);
    if (path === '/openapi.json') return response.send(server.openApi(), 200);
    return response.send((path === '/.cratis/commands' ? server.commands : server.queries).map(item => ({
        name: item.name, namespace: item.namespace ?? '', route: item.route, type: item.name,
        documentationSummary: item.summary ?? '', ...(item.kind === 'command' ? { payloadSchema: item.inputSchema } : {
            fullyQualifiedName: item.fullyQualifiedName, argumentsSchema: item.inputSchema
        })
    })), 200);
}
