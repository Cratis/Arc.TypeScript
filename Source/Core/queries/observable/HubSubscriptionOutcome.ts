// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Result of admitting and running one hub subscription generation. */
export enum HubSubscriptionOutcome {
    Accepted = 'accepted',
    Unauthorized = 'unauthorized',
    Invalid = 'invalid',
    Limited = 'limited',
    Stale = 'stale'
}
