// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { Principal } from '../identity/Principal.js';
import type { ClassType } from '../reflection/ClassType.js';
import type { DescriptorBase } from '../http/DescriptorBase.js';

/** The selected caller, operation and request data supplied before validation. */
export interface AuthorizationPolicyContext {
    readonly principal: Principal;
    readonly target: DescriptorBase;
    readonly resource: { readonly input: unknown; readonly execution: ExecutionContext };
}

/** A scoped, injectable named policy. False denies access and errors fail closed. */
export interface AuthorizationPolicy {
    authorize(context: AuthorizationPolicyContext): boolean | Promise<boolean>;
}

/** Existing callback form of a named policy. */
export type AuthorizationPolicyFunction = (principal: Principal, context: ExecutionContext) => boolean | Promise<boolean>;
export type AuthorizationPolicyRegistration = AuthorizationPolicyFunction | ClassType<AuthorizationPolicy>;
