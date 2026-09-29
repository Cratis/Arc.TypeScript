// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** A host-owned activity that must stop admitting work and settle before Arc disposes its services. */
export interface ShutdownParticipant {
    /** Synchronously stop admission and request cancellation of in-flight work. */
    stop(): void;
    /** Wait until all admitted work has settled; rejection is reported after all participants drain. */
    drain(): Promise<void>;
}
