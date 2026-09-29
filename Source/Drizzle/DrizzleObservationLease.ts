// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Internal ownership of one change source; readiness precedes the first model read. */
export interface DrizzleObservationLease {
    readonly ready: Promise<void>;
    /** Wait for a live listener before reading, and fence reads started on an older connection. */
    whenReady?(): Promise<number>;
    isCurrent?(generation: number): boolean;
    release(): void;
}
