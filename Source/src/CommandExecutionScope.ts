// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from './ExecutionContext.js';
import type { CommandResult } from './CommandResult.js';
export interface CommandExecutionScope { begin(context: ExecutionContext): void | Promise<void>; complete(context: ExecutionContext, result: CommandResult): void | Promise<void> }
