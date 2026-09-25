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
} | {
    readonly eventStore: string;
    /** Opt in to waiting for kernel observer completion after each committed command (milliseconds). */
    readonly completionTimeoutMs?: number;
    readonly connectionString: string;
    readonly client?: never;
};
