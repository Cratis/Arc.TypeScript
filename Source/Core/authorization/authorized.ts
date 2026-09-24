// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization, ExecutionContext } from '../index.js';
import type { AuthorizationPolicy } from './AuthorizationPolicy.js';
import { authorizationRequirements } from './authorizationRequirements.js';

/** Evaluate all declarations; role alternatives are OR, declarations and policies are AND. */
export async function authorized(requirement: Authorization | undefined, context: ExecutionContext,
    policies: Readonly<Record<string, AuthorizationPolicy>> = {}): Promise<boolean> {
    for (const item of authorizationRequirements(requirement)) {
        if (item.anonymous) continue;
        if (!item.authenticated && !item.roles?.length && !item.policy && !item.schemes?.length) continue;
        const principal = context.principal;
        if (!principal?.isAuthenticated) return false;
        if (item.schemes?.length && !item.schemes.includes(principal.scheme ?? '')) return false;
        if (item.roles?.length && !item.roles.some(role => principal.roles.includes(role))) return false;
        if (item.policy) {
            const policy = Object.hasOwn(policies, item.policy) ? policies[item.policy] : undefined;
            if (!policy) return false;
            if (!await policy(principal, context)) return false;
        }
    }
    return true;
}
