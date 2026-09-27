// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Per-invocation overrides for trusted borrowed scope work. */
export interface RunInScopeOptions {
    /** A valid UUID; normalized to lowercase. */
    readonly correlationId?: string;
    /** Additional cancellation, linked to the scope's signal. */
    readonly signal?: AbortSignal;
}
