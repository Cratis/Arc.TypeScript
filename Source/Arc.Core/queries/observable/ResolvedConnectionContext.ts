// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../../execution/ExecutionContext.js';

/** Trusted authentication and tenancy resolved once before an upgraded socket is accepted. */
export interface ResolvedConnectionContext {
    readonly context: ExecutionContext;
    readonly authenticationFailed: boolean;
}
