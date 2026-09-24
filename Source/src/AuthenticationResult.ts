// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Principal } from './Principal.js';
import type { AuthenticationStatus } from './AuthenticationStatus.js';
export type AuthenticationResult =
    | { status: AuthenticationStatus.Anonymous }
    | { status: AuthenticationStatus.Failed }
    | { status: AuthenticationStatus.Authenticated; principal: Principal };
