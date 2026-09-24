// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { ExecutionContext } from './ExecutionContext.js';
import type { Outcome } from './Outcome.js';
import type { CommandExecutionScope } from './CommandExecutionScope.js';
import type { CommandFilter } from './CommandFilter.js';
import type { DescriptorBase } from './DescriptorBase.js';
export interface CommandDefinition<S extends z.ZodType, T> extends DescriptorBase {
    schema: S;
    authorize?: (input: z.output<S>, context: ExecutionContext) => boolean | Promise<boolean>;
    validate?: CommandFilter<z.output<S>>;
    provide?: (input: z.output<S>, context: ExecutionContext) => Outcome<unknown> | unknown | Promise<Outcome<unknown> | unknown>;
    handle: (input: z.output<S>, context: ExecutionContext, provided: unknown) => T | Outcome<T> | Promise<T | Outcome<T>>;
    scopes?: readonly (() => CommandExecutionScope)[];
    filters?: readonly CommandFilter<z.output<S>>[];
}
