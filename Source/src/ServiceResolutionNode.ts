// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceScope } from './ServiceScope.js';
import type { ServiceResolutionState } from './ServiceResolutionState.js';
/** Identity and liveness of one resolution attempt in its owning scope. */
export interface ServiceResolutionNode {
    readonly scope: ServiceScope;
    readonly token: symbol;
    state: ServiceResolutionState;
}
