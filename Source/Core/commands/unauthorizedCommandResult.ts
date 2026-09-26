// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext } from './CommandContext.js';
import type { CommandResult } from './CommandResult.js';
import { commandResult } from './createCommandResult.js';

/** Return a command authorization denial with an optional client-visible reason, like .NET CommandResult.Unauthorized. */
export function unauthorizedCommandResult(context: CommandContext, reason?: string): CommandResult {
    return commandResult(context, { isAuthorized: false, authorizationFailureReason: reason });
}
