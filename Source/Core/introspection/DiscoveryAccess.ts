// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Startup-resolved access, shared by route registration and request dispatch. */
export interface DiscoveryAccess {
    readonly mapped: boolean;
    readonly requireAuthentication: boolean;
    readonly roles: readonly string[];
}
