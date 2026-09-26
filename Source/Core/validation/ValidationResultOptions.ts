// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Optional metadata for a validation result. */
export interface ValidationResultOptions {
    /** Members to which the result applies. */
    members?: string[];
    /** Rule-author-owned state carried to the caller. */
    state?: unknown;
    /** Machine-readable reason; defaults to `rule`. */
    reason?: string;
    /** Identity of the specific rejection within the reason category. */
    reasonDetail?: string;
}
