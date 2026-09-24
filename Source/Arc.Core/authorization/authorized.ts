// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization, ExecutionContext } from '../index.js';

export function authorized(requirement: Authorization | undefined, context: ExecutionContext): boolean {
    if (requirement?.anonymous) return true;
    if (!requirement?.authenticated && !requirement?.roles?.length) return true;
    return !!context.principal?.isAuthenticated &&
        (!requirement.roles?.length || requirement.roles.some(role => context.principal?.roles.includes(role)));
}
