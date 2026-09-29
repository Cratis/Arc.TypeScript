// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IChronicleClient, ReadModelNamingPolicy } from '@cratis/chronicle';

/** Choose either a caller-owned SDK client or an Arc-owned connection. */
export type ChronicleRegistration = {
    readonly eventStore: string;
    /** Opt in to waiting for kernel observer completion after each committed command (milliseconds). */
    readonly completionTimeoutMs?: number;
    readonly client: IChronicleClient;
    readonly connectionString?: never;
    /** Not accepted with a caller-owned client: set `readModelNamingPolicy` in the `ChronicleOptions` you create it with. */
    readonly readModelNamingPolicy?: never;
    /**
     * Preview: construct reactors and reducers in an Arc service scope per delivery. The client must have been created with
     * `artifactActivator: chronicleArtifactActivator(...)` for this event store; registration verifies only that. Passing
     * `reactorResultHandler: reactorCommandResultHandler(...)` is the caller's responsibility; without it, returned commands
     * are not executed through Arc. Arc never changes or disposes the client.
     */
    readonly activateArtifactsInScopes?: boolean;
} | {
    readonly eventStore: string;
    /** Opt in to waiting for kernel observer completion after each committed command (milliseconds). */
    readonly completionTimeoutMs?: number;
    /**
     * Preview: construct reactors and reducers in an Arc service scope per delivery, with the observation's tenant
     * and correlation.
     */
    readonly activateArtifactsInScopes?: boolean;
    /**
     * Names the container each read model is stored in, given its identifier and, when known, its class. By default,
     * when the application uses `withMongoDB`, a read model class is stored in the collection Arc's MongoDB integration
     * reads it from, and one known only by identifier keeps that identifier as its name. Without `withMongoDB`
     * the SDK default applies: the identifier. Setting this replaces that default.
     */
    readonly readModelNamingPolicy?: ReadModelNamingPolicy;
    readonly connectionString: string;
    readonly client?: never;
};
