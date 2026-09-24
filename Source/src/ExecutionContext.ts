// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Severity } from './Severity.js';
import type { Principal } from './Principal.js';
export interface ExecutionContext {
    readonly correlationId: string;
    readonly principal: Principal | undefined;
    readonly tenantId: string | undefined;
    /** Trusted transport identity for anonymous subscription admission. */
    readonly connectionId?: string;
    readonly remoteAddress?: string;
    readonly signal: AbortSignal;
    readonly allowedSeverity: Severity;
}
