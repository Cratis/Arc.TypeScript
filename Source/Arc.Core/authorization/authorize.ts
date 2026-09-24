// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { authorizationDecorator } from './authorizationDecorator.js';
import type { DualClassDecorator } from '../reflection/DualClassDecorator.js';
import type { SimpleMemberDecorator } from '../reflection/SimpleMemberDecorator.js';

/** Require an authenticated principal. */
export function authorize(): DualClassDecorator & SimpleMemberDecorator { return authorizationDecorator({ authenticated: true }); }
