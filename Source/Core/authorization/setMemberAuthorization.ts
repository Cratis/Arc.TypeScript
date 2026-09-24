// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from './Authorization.js';
import { combineAuthorization } from './combineAuthorization.js';
import { memberMetadata } from '../reflection/memberMetadata.js';

/** Add an independent authorization requirement for this member. */
export function setMemberAuthorization(target: object, name: string, authorization: Authorization,
    context?: { metadata?: DecoratorMetadataObject }): void {
    const metadata = memberMetadata(target, name, context);
    metadata.methodAuthorization = new Map(metadata.methodAuthorization);
    const existing = metadata.methodAuthorization.get(name);
    metadata.methodAuthorization.set(name, combineAuthorization(existing, authorization));
}
