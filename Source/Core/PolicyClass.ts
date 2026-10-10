// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { AuthorizationPolicy } from './authorization/AuthorizationPolicy.js';

/** Constructor of a class-based authorization policy. */
export type PolicyClass = abstract new (...arguments_: never[]) => AuthorizationPolicy;
