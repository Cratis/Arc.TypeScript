// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization, ExecutionContext } from '../index.js';

/** Evaluate every declared requirement; roles within each requirement are alternatives. */
export function authorized(requirement: Authorization | undefined, context: ExecutionContext): boolean {
    if (requirement?.requirements) return requirement.requirements.every(item => authorized(item, context));
    if (requirement?.anonymous) return true;
    if (!requirement?.authenticated && !requirement?.roles?.length) return true;
    return !!context.principal?.isAuthenticated &&
        (!requirement.roles?.length || requirement.roles.some(role => context.principal?.roles.includes(role)));
}
