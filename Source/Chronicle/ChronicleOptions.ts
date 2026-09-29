// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IChronicleClient } from '@cratis/chronicle';

/** Choose either a caller-owned SDK client or an Arc-owned connection. */
export type ChronicleRegistration = {
    readonly eventStore: string;
    /** Opt in to waiting for kernel observer completion after each committed command (milliseconds). */
    readonly completionTimeoutMs?: number;
    readonly client: IChronicleClient;
    readonly connectionString?: never;
    /** Not supported with a caller-owned client yet; pass `chronicleArtifactActivator` to the client instead. */
    readonly activateArtifactsInScopes?: never;
} | {
    readonly eventStore: string;
    /** Opt in to waiting for kernel observer completion after each committed command (milliseconds). */
    readonly completionTimeoutMs?: number;
    /**
     * Preview: construct reactors and reducers in an Arc service scope per delivery, with the observation's tenant
     * and correlation. Requires an Arc-owned connection and @cratis/chronicle 6.17.0 or later; registration fails on
     * older SDKs.
     */
    readonly activateArtifactsInScopes?: boolean;
    readonly connectionString: string;
    readonly client?: never;
};
