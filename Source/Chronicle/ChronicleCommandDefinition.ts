// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandDefinition, ExecutionContext } from '@cratis/arc.core';
import type { IChronicleClient } from '@cratis/chronicle';
import type { z } from 'zod';
import type { EventSourceReference } from './EventSourceReference.js';
import type { ChronicleProduced } from './ChronicleProduced.js';

/** Application-controlled namespace selection, not inferred from untrusted request headers. */
export interface ChronicleCommandDefinition<S extends z.ZodType, T> extends Omit<CommandDefinition<S, T | undefined>, 'handle'> {
    readonly client: IChronicleClient;
    readonly eventStore: string;
    /** Opt in to a bounded wait for kernel observer completion after a successful append (milliseconds). */
    readonly completionTimeoutMs?: number;
    /**
     * Append through a Chronicle event source definition (and optionally one of its streams): each event records its event
     * source, and Chronicle derives the concurrency scope from the definition. An event that names its own source or stream
     * replaces this default. Requires `@cratis/chronicle` 6.49.0 or later.
     */
    readonly eventSource?: EventSourceReference;
    readonly namespaceForContext: (context: ExecutionContext) => string;
    readonly produce: (input: z.output<S>, context: ExecutionContext, provided: unknown) => ChronicleProduced<T> | Promise<ChronicleProduced<T>>;
}
