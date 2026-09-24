// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from './Authorization.js';
import type { AuthorizationPolicy } from './AuthorizationPolicy.js';

/** Flatten independent declarations without changing their AND semantics. */
export function authorizationRequirements(value: Authorization | undefined): readonly Authorization[] {
    return value?.requirements?.flatMap(authorizationRequirements) ?? (value ? [value] : []);
}

/** Refuse unknown policies and schemes before accepting requests. */
export function validateAuthorization(value: Authorization | undefined, name: string,
    policies: Readonly<Record<string, AuthorizationPolicy>>, schemes: Readonly<Record<string, unknown>>): void {
    const requirements = authorizationRequirements(value);
    if (requirements.some(item => item.anonymous) && requirements.some(item =>
        item.authenticated || item.roles?.length || item.policy || item.schemes?.length))
        throw new Error(`Conflicting Arc authorization: ${name}`);
    for (const item of requirements) {
        if (item.policy !== undefined && (!item.policy.trim() || !Object.hasOwn(policies, item.policy) ||
            typeof policies[item.policy] !== 'function')) throw new Error(`Unknown authorization policy: ${item.policy}`);
        for (const scheme of item.schemes ?? []) if (!scheme.trim() || !Object.hasOwn(schemes, scheme))
            throw new Error(`Unknown authentication scheme: ${scheme}`);
    }
}
