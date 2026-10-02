// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { defineQuery } from '../../../queries/defineQuery.js';
import { identityGet } from '../../../for_ArcServer/given/an_identity_request.js';
import type { AuthenticationHandler } from '../../AuthenticationHandler.js';
import type { Principal } from '../../../identity/Principal.js';

export class an_identity_recipe {
    server!: ArcServer;
    provide = sinon.spy((principal: Principal) => ({ greeting: `Hello ${principal.name ?? principal.id}` }));

    configure(handler: AuthenticationHandler): void {
        this.provide.resetHistory();
        this.server = new ArcServer({
            authentication: [handler],
            identityDetails: { schema: z.object({ greeting: z.string() }), provide: this.provide },
            authorizationPolicies: {
                ReportsRead: principal => {
                    const claims = principal.claims as Record<string, unknown> | undefined;
                    return typeof claims?.scp === 'string' && claims.scp.split(' ').includes('Reports.Read');
                }
            },
            queries: [
                defineQuery({ name: 'RoleReports', schema: z.object({}),
                    authorization: { roles: ['Reports.Read'] }, perform: () => 'role granted' }),
                defineQuery({ name: 'ScopeReports', schema: z.object({}),
                    authorization: { policy: 'ReportsRead', authenticated: true }, perform: () => 'scope granted' })
            ]
        });
    }

    async get(path: string, headers: HeadersInit = {}): Promise<Response> {
        const response = await identityGet(this.server, path, headers);
        if (!response) throw new Error(`Missing recipe route ${path}`);
        return response;
    }

    async dispose(): Promise<void> { await this.server?.dispose(); }
}
