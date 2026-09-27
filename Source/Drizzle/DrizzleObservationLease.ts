// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Internal ownership of one change source; readiness precedes the first model read. */
export interface DrizzleObservationLease {
    readonly ready: Promise<void>;
    release(): void;
}
