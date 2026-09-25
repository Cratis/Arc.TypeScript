// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { Outcome } from './Outcome.js';
import type { CommandExecutionScope } from './CommandExecutionScope.js';
import type { CommandFilter } from './CommandFilter.js';
import type { DescriptorBase } from '../http/DescriptorBase.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
export interface CommandDefinition<S extends z.ZodType, T> extends DescriptorBase {
    schema: S;
    /** Materialize a model-bound command for context and key resolution. */
    commandFactory?: (input: z.output<S>) => unknown;
    /** Preflight without constructing handler services during validation-only requests. */
    handlerDependencies?: readonly ServiceIdentifier<unknown>[];
    /** Constructed before validation; validators can access them through currentServices(). */
    validatorDependencies?: readonly ServiceIdentifier<unknown>[];
    authorize?: (input: z.output<S>, context: ExecutionContext) => boolean | Promise<boolean>;
    validate?: CommandFilter<z.output<S>>;
    provide?: (input: z.output<S>, context: ExecutionContext) => Outcome<unknown> | unknown | Promise<Outcome<unknown> | unknown>;
    handle: (input: z.output<S>, context: ExecutionContext, provided: unknown) => T | Outcome<T> | Promise<T | Outcome<T>>;
    /** Encode only the client response after server-only return handlers have consumed their values. */
    encodeResponse?: (response: unknown) => unknown;
    scopes?: readonly (() => CommandExecutionScope)[];
    filters?: readonly CommandFilter<z.output<S>>[];
}
