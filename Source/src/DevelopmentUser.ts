// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Development picker user. Not an authentication credential. */
export interface DevelopmentUser {
    readonly microsoftIdentity: {
        readonly identityProvider: string;
        readonly userId: string;
        readonly userDetails: string;
        readonly userRoles: readonly string[];
        readonly claims: readonly { readonly typ: string; readonly val: string }[];
    };
    readonly details?: unknown;
}
