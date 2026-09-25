// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from '../commands/CommandResult.js';
import type { QueryResult } from '../queries/QueryResult.js';

export function status(result: CommandResult | QueryResult): number {
    if (result.isSuccess) return 200;
    if (!result.isAuthorized) return 403;
    if (!result.isValid) return 400;
    if ('isReady' in result && !result.isReady) return 202;
    return 500;
}
