// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { randomUUID } from 'node:crypto';
import type { AuthenticationHandler, Authorization, ExecutionContext, Principal, Severity } from './contracts.js';
import { AuthenticationStatus } from './AuthenticationStatus.js';
import { Severity as SeverityValue } from './Severity.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function correlation(value: string | null): string {
    return value && uuid.test(value) && value.toLowerCase() !== '00000000-0000-0000-0000-000000000000' ? value.toLowerCase() : randomUUID();
}
export async function authenticate(request: Request, handlers: readonly AuthenticationHandler[]): Promise<{ principal?: Principal; failed: boolean }> {
    for (const handler of handlers) {
        const result = await handler(request);
        if (result.status === AuthenticationStatus.Anonymous) continue;
        if (result.status === AuthenticationStatus.Failed) return { failed: true };
        if (result.status !== AuthenticationStatus.Authenticated) throw new Error('Authentication handler returned an unknown outcome');
        const principal = result.principal;
        if (!principal || principal.isAuthenticated !== true || typeof principal.id !== 'string' ||
            !Array.isArray(principal.roles) || principal.roles.some(role => typeof role !== 'string')) {
            throw new Error('Authentication handler returned an invalid principal');
        }
        return { failed: false, principal: Object.freeze({ ...principal, roles: Object.freeze([...principal.roles]) }) };
    }
    return { failed: false };
}
export function authorized(requirement: Authorization | undefined, context: ExecutionContext): boolean {
    if (requirement?.anonymous) return true;
    if (!requirement?.authenticated && !requirement?.roles?.length) return true;
    return !!context.principal?.isAuthenticated &&
        (!requirement.roles?.length || requirement.roles.some(role => context.principal?.roles.includes(role)));
}
export function allowedSeverity(value: string | null): Severity {
    return value !== null && /^[0-3]$/.test(value) ? Number(value) as Severity : SeverityValue.Warning;
}
