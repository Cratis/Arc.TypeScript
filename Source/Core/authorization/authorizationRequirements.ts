// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from './Authorization.js';
import type { AuthorizationPolicyRegistration } from './AuthorizationPolicy.js';
import { InvalidAuthorizationConfiguration } from './InvalidAuthorizationConfiguration.js';

/** Flatten independent declarations without changing their AND semantics. */
export function authorizationRequirements(value: Authorization | undefined): readonly Authorization[] {
    return value?.requirements?.flatMap(authorizationRequirements) ?? (value ? [value] : []);
}

/** Refuse unknown policies and schemes before accepting requests. */
export function validateAuthorization(value: Authorization | undefined, name: string,
    policies: Readonly<Record<string, AuthorizationPolicyRegistration>>, schemes: Readonly<Record<string, unknown>>): void {
    const requirements = authorizationRequirements(value);
    if (requirements.some(item => item.anonymous) && requirements.some(item =>
        item.authenticated || item.roles?.length || item.policy || item.schemes?.length))
        throw new Error(`Conflicting Arc authorization: ${name}`);
    if (requirements.filter(item => item.schemes?.length).length > 1)
        throw new InvalidAuthorizationConfiguration(`Multiple authentication scheme declarations: ${name}`);
    for (const item of requirements) {
        if (item.policy !== undefined) {
            const policy = Object.hasOwn(policies, item.policy) ? policies[item.policy] : undefined;
            if (!item.policy.trim() || typeof policy !== 'function' ||
                /^class[\s{]/.test(Function.prototype.toString.call(policy)) && typeof policy.prototype?.authorize !== 'function')
                throw new InvalidAuthorizationConfiguration(`Unknown authorization policy '${item.policy}'.`);
        }
        for (const scheme of item.schemes ?? []) if (!scheme.trim() || typeof (Object.hasOwn(schemes, scheme) ? schemes[scheme] : undefined) !== 'function')
            throw new InvalidAuthorizationConfiguration(`Unknown authentication scheme: ${scheme}`);
    }
}
