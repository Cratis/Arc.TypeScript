// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { authorizationDecorator } from './authorizationDecorator.js';
import type { DualClassDecorator } from '../reflection/DualClassDecorator.js';
import type { SimpleMemberDecorator } from '../reflection/SimpleMemberDecorator.js';

/** Allow anonymous access for this query or command declaration. */
export function allowAnonymous(): DualClassDecorator & SimpleMemberDecorator { return authorizationDecorator({ anonymous: true }); }
