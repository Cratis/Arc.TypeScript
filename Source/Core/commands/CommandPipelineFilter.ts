// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext } from './CommandContext.js';
import type { CommandResult } from './CommandResult.js';

/** Filter every command with a result fragment. Named separately from the existing per-definition CommandFilter<T> callback. */
export interface CommandPipelineFilter {
    onExecution(context: CommandContext): CommandResult | void | Promise<CommandResult | void>;
}
