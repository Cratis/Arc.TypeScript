// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext } from './CommandContext.js';
import type { CommandResult } from './CommandResult.js';
import { commandResult } from './createCommandResult.js';

/** Create a result fragment for a global command filter, preserving the invocation correlation ID. */
export function commandFilterResult(context: CommandContext, values: Partial<CommandResult> = {}): CommandResult {
    return commandResult(context, values);
}
