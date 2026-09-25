// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { CommandContextValues } from './CommandContextValues.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import type { ReadModelForCommandResolver } from './ReadModelForCommandResolver.js';
/** A command's identity and values, shared by filters, handlers, scopes, and response handlers. */
export interface CommandContext extends ExecutionContext {
    /** The declared, namespace-qualified operation name on framework-created contexts; absent on manual contexts. */
    readonly operationName?: string;
    readonly command: unknown;
    readonly key: string | undefined;
    readonly values: CommandContextValues;
    readonly readModelResolvers?: readonly ServiceIdentifier<ReadModelForCommandResolver>[];
    response?: unknown;
}
