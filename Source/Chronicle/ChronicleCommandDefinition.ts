// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandDefinition, ExecutionContext } from '@cratis/arc.core';
import type { IChronicleClient } from '@cratis/chronicle';
import type { z } from 'zod';
import type { ChronicleProduced } from './ChronicleProduced.js';

/** Application-controlled namespace selection, not inferred from untrusted request headers. */
export interface ChronicleCommandDefinition<S extends z.ZodType, T> extends Omit<CommandDefinition<S, T | undefined>, 'handle'> {
    readonly client: IChronicleClient;
    readonly eventStore: string;
    readonly namespaceForContext: (context: ExecutionContext) => string;
    readonly produce: (input: z.output<S>, context: ExecutionContext, provided: unknown) => ChronicleProduced<T> | Promise<ChronicleProduced<T>>;
}
