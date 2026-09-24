// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { Principal } from '../identity/Principal.js';

/** A named, asynchronous authorization rule; false denies access and errors fail closed. */
export type AuthorizationPolicy = (principal: Principal, context: ExecutionContext) => boolean | Promise<boolean>;
