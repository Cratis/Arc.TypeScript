// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IChronicleClient } from '@cratis/chronicle';

/** Choose either a caller-owned SDK client or an Arc-owned connection. */
export type ChronicleRegistration = {
    readonly eventStore: string;
    readonly client: IChronicleClient;
    readonly connectionString?: never;
} | {
    readonly eventStore: string;
    readonly connectionString: string;
    readonly client?: never;
};
