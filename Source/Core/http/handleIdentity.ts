// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { ArcServer } from '../ArcServer.js';
import type { Principal } from '../identity/Principal.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { NativeRequestContext } from './NativeRequestContext.js';
import type { RequestBindings } from './handleRequest.js';
import type { EndpointResponse } from './EndpointResponse.js';
import { observe } from '../execution/observability.js';
import { utf8Bytes } from './utf8Bytes.js';

/** Resolve the current identity and its client cookie in the provider's scope. */
export async function handleIdentity(server: ArcServer, bindings: RequestBindings, context: ExecutionContext,
    principal: Principal, native: NativeRequestContext | undefined, response: EndpointResponse): Promise<Response> {
    const json = await observe('cratis.arc.identity.resolve', context.correlationId, {}, () => bindings.runProvider(context, async () => {
        const details = await server.options.identityDetails!.provide(principal, context);
        if (details === undefined) return undefined;
        const parsed = server.options.identityDetails!.schema!.parse(details);
        const identity = { id: principal.id, name: principal.name ?? '', isAuthenticated: true, isAuthorized: true,
            roles: principal.roles, details: parsed };
        const serialized = JSON.stringify(identity);
        // atob() in the existing client decodes bytes as Latin-1, not UTF-8.
        const cookieJson = serialized.replace(/[\u007f-\uffff]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
        const cookie = `.cratis-identity=${btoa(cookieJson)}; Path=/; SameSite=Lax${native?.secure === true ? '; Secure' : ''}`;
        if (utf8Bytes(cookie) > 4096) throw new Error('Identity details too large');
        return { serialized, cookie };
    }));
    if (json === undefined) return response.send({ error: 'Forbidden' }, 403);
    return new Response(json.serialized, { status: 200, headers: new Headers({
        ...Object.fromEntries(response.headers), 'content-type': 'application/json; charset=utf-8', 'set-cookie': json.cookie
    }) });
}

/** Serve validated development users or tenants from configured providers. */
export async function handleDiscovery(server: ArcServer, bindings: RequestBindings, path: string,
    context: ExecutionContext, response: EndpointResponse): Promise<Response> {
    const provider = path === '/.cratis/users' ? server.options.developmentUsers : server.options.developmentTenants;
    if (!provider) return response.send([], 200);
    const json = await bindings.runProvider(context, async () => {
        const providers = Array.isArray(provider) ? provider : [provider];
        const values: unknown = (await Promise.all(providers.map(provide => provide(context)))).flat();
        const schema = path === '/.cratis/users'
            ? z.array(z.object({ microsoftIdentity: z.object({ identityProvider: z.string().max(256), userId: z.string().max(256),
                userDetails: z.string().max(256), userRoles: z.array(z.string().max(256)).max(64),
                claims: z.array(z.object({ typ: z.string().max(256), val: z.string().max(256) })).max(64) }),
                details: z.unknown().optional() })).max(100)
            : z.array(z.object({ id: z.string().max(256), name: z.string().max(256) })).max(100);
        const serialized = JSON.stringify(schema.parse(values));
        if (utf8Bytes(serialized) > 32 * 1024) throw new Error('Discovery output too large');
        return serialized;
    });
    return new Response(json, { status: 200, headers: new Headers({
        ...Object.fromEntries(response.headers), 'content-type': 'application/json; charset=utf-8'
    }) });
}
