// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext } from './CommandContext.js';
import type { CommandResult } from './CommandResult.js';

/** Authorize every command before ordinary filters, validation, or handler dependencies are resolved. */
export interface AuthorizationCommandFilter {
    onExecution(context: CommandContext): CommandResult | void | Promise<CommandResult | void>;
}
