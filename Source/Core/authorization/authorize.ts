// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { authorizationDecorator } from './authorizationDecorator.js';
import type { DualClassDecorator } from '../reflection/DualClassDecorator.js';
import type { SimpleMemberDecorator } from '../reflection/SimpleMemberDecorator.js';

/** Require authentication, a named policy, and/or any of the specified roles. Stacked declarations are ANDed. */
export function authorize(value?: string | { policy?: string; roles?: readonly string[]; schemes?: readonly string[] }): DualClassDecorator & SimpleMemberDecorator {
    const options = typeof value === 'string' ? { policy: value } : value;
    if (options?.policy !== undefined && !options.policy.trim()) throw new Error('Authorization policy must not be empty');
    if (options?.roles?.some(role => !role.trim()) || options?.schemes?.some(scheme => !scheme.trim()))
        throw new Error('Authorization roles and schemes must not be empty');
    return authorizationDecorator({ authenticated: true, ...options });
}
