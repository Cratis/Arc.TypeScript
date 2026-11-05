// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import express, { type Request, type Response, type Router } from 'express';
import { cookieValue, demoUsers, userCookie } from '../DemoUsers.js';

/** The tenant cookie. The toolbar sets it; the server only accepts the tenants listed below. */
export const tenantCookie = 'showcase-tenant';
export const tenants = ['default', 'acme', 'globex'] as const;

/** The tenant a Cookie header selects; anything unknown falls back to `default`, so it can never name a database. */
export function tenantFromCookies(header: string | undefined): string {
    const tenant = cookieValue(header, tenantCookie);
    return tenants.find(known => known === tenant) ?? 'default';
}

function remember(response: Response, name: string, value: string | undefined): void {
    if (value) response.cookie(name, value, { httpOnly: true, sameSite: 'lax', path: '/' });
    else response.clearCookie(name, { path: '/' });
}

/**
 * Demonstration-only session routes: `POST /showcase/session` with `{ user?, tenant? }` signs a synthetic user in
 * or out and selects the tenant. Nothing here verifies a credential.
 */
export function signInRoutes(): Router {
    const router = express.Router();
    router.use(express.json());
    router.get('/session', (request: Request, response: Response) => {
        response.json({ user: cookieValue(request.headers.cookie, userCookie) ?? null, tenant: tenantFromCookies(request.headers.cookie) });
    });
    router.post('/session', (request: Request, response: Response) => {
        const body = (request.body ?? {}) as { user?: string | null; tenant?: string };
        if ('user' in body) remember(response, userCookie, body.user && body.user in demoUsers ? body.user : undefined);
        if (body.tenant) remember(response, tenantCookie, tenants.find(known => known === body.tenant));
        response.status(204).end();
    });
    return router;
}
