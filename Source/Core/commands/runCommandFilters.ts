// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcOptions } from '../ArcOptions.js';
import { currentServices } from '../dependencyInjection/ServiceScope.js';
import { recordFailure } from '../execution/failureTracking.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import type { CommandContext } from './CommandContext.js';
import type { CommandResult } from './CommandResult.js';
import type { AuthorizationCommandFilter } from './AuthorizationCommandFilter.js';
import type { CommandPipelineFilter } from './CommandPipelineFilter.js';
import { commandResult } from './createCommandResult.js';
import { mergeFilterFragment } from '../execution/mergeFilterFragment.js';

/** Run one filter group, applying severity before deciding whether to stop the chain. */
export async function runCommandFilters(context: CommandContext, options: ArcOptions, authorization: boolean):
    Promise<{ result: CommandResult; blocked: boolean }> {
    const tokens: readonly ServiceIdentifier<AuthorizationCommandFilter | CommandPipelineFilter>[] = authorization
        ? options.authorizationCommandFilters ?? [] : options.commandPipelineFilters ?? [];
    let result = commandResult(context);
    let blocked = false;
    for (const token of new Set(tokens)) {
        let fragment: CommandResult | void;
        try {
            fragment = await (await currentServices().resolve(token)).onExecution(context);
            if (fragment) {
                const merged = mergeFilterFragment(result, fragment);
                result = commandResult(context, { ...merged,
                    authorizationFailureReason: result.authorizationFailureReason || fragment.authorizationFailureReason,
                    validationResults: merged.validationResults.filter(item => item.severity > context.allowedSeverity)
                });
            }
        } catch (error) {
            result = commandResult(context, { ...result, exceptionMessages: [...result.exceptionMessages, String(error)],
                response: undefined });
            recordFailure(result, error);
            return { result, blocked: true };
        }
        if (!result.isSuccess) { blocked = true; break; }
    }
    return { result, blocked };
}
