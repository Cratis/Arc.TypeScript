// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { CommandContextValues } from './CommandContextValues.js';
/** A command's identity and values, shared by filters, handlers, scopes, and response handlers. */
export interface CommandContext extends ExecutionContext {
    readonly command: unknown;
    readonly key: string | undefined;
    readonly values: CommandContextValues;
    response?: unknown;
}
