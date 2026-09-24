// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from './Authorization.js';

export function combineAuthorization(existing: Authorization | undefined, requirement: Authorization): Authorization {
    if (!existing) return requirement;
    const requirements = existing.requirements ?? [existing];
    return {
        requirements: [...requirements, requirement],
        authenticated: requirements.some(item => item.authenticated) || requirement.authenticated,
        anonymous: requirements.some(item => item.anonymous) || requirement.anonymous
    };
}
