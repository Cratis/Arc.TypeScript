// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { authorizationDecorator } from './authorizationDecorator.js';
import type { DualClassDecorator } from '../reflection/DualClassDecorator.js';
import type { SimpleMemberDecorator } from '../reflection/SimpleMemberDecorator.js';

/** Require any role in this declaration and all other stacked declarations. */
export function roles(...names: string[]): DualClassDecorator & SimpleMemberDecorator {
    if (!names.length || names.some(name => !name.trim())) throw new Error('Roles must not be empty');
    return authorizationDecorator({ roles: names, authenticated: true });
}
