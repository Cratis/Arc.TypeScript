// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from './Authorization.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { DescriptorBase } from '../http/DescriptorBase.js';
import { currentServices } from '../dependencyInjection/ServiceScope.js';
import type { AuthorizationPolicy, AuthorizationPolicyFunction, AuthorizationPolicyRegistration } from './AuthorizationPolicy.js';
import { authorizationRequirements } from './authorizationRequirements.js';
import { throwIfCanceled } from '../execution/throwIfCanceled.js';

/** Evaluate all declarations; role alternatives are OR, declarations and policies are AND. */
export async function authorized(requirement: Authorization | undefined, context: ExecutionContext,
    policies: Readonly<Record<string, AuthorizationPolicyRegistration>>, target: DescriptorBase, input: unknown): Promise<boolean> {
    for (const item of authorizationRequirements(requirement)) {
        throwIfCanceled(context, 'Operation canceled');
        if (item.anonymous) continue;
        if (!item.authenticated && !item.roles?.length && !item.policy && !item.schemes?.length) continue;
        const principal = context.principal;
        if (!principal?.isAuthenticated) return false;
        if (item.schemes?.length && !item.schemes.includes(principal.scheme ?? '')) return false;
        if (item.roles?.length && !item.roles.some(role => principal.roles.includes(role))) return false;
        if (item.policy) {
            const policy = Object.hasOwn(policies, item.policy) ? policies[item.policy] : undefined;
            if (!policy) return false;
            throwIfCanceled(context, 'Operation canceled');
            let allowed: boolean;
            if (typeof policy.prototype?.authorize === 'function') {
                const service = await currentServices().resolve(policy as abstract new (...arguments_: never[]) => AuthorizationPolicy);
                throwIfCanceled(context, 'Operation canceled');
                allowed = await service.authorize({ principal, target, resource: { input, execution: context } });
            } else allowed = await (policy as AuthorizationPolicyFunction)(principal, context);
            throwIfCanceled(context, 'Operation canceled');
            if (!allowed) return false;
        }
    }
    return true;
}
