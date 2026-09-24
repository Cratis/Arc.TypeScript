// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** The most restrictive outcome across emission guards governs delivery. */
export enum ObservableEmissionDecision {
    Allow = 'Allow',
    Suppress = 'Suppress',
    DenyAndTerminate = 'DenyAndTerminate'
}
