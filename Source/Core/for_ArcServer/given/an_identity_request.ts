// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';

export const identityPrincipal = { id: 'ada', name: 'Åda 🌿', roles: ['Reader'], isAuthenticated: true,
    claims: { tenant: 'north', memberships: 'north,south' } };
export const identityDetails = { schema: z.object({ greeting: z.string() }), provide: () => ({ greeting: 'こんにちは 🌿' }) };
export const identityGet = (server: ArcServer, path: string, headers?: HeadersInit) =>
    server.handle(new Request(`http://arc.invalid${path}`, { headers }));
