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

/** Run one explicitly registered filter group, stopping on the first blocking fragment before applying severity. */
export async function runCommandFilters(context: CommandContext, options: ArcOptions, authorization: boolean):
    Promise<{ result: CommandResult; blocked: boolean }> {
    const tokens: readonly ServiceIdentifier<AuthorizationCommandFilter | CommandPipelineFilter>[] = authorization
        ? options.authorizationCommandFilters ?? [] : options.commandPipelineFilters ?? [];
    let result = commandResult(context);
    let blocked = false;
    for (const token of tokens) {
        let fragment: CommandResult | void;
        try { fragment = await (await currentServices().resolve(token)).onExecution(context); }
        catch (error) {
            result = commandResult(context, { ...result, exceptionMessages: [...result.exceptionMessages, String(error)],
                response: undefined });
            recordFailure(result, error);
            return { result, blocked: true };
        }
        if (fragment) result = commandResult(context, {
            isAuthorized: result.isAuthorized && fragment.isAuthorized,
            authorizationFailureReason: result.authorizationFailureReason || fragment.authorizationFailureReason,
            validationResults: [...result.validationResults, ...fragment.validationResults],
            exceptionMessages: [...result.exceptionMessages, ...fragment.exceptionMessages],
            exceptionStackTrace: [result.exceptionStackTrace, fragment.exceptionStackTrace].filter(Boolean).join('\n')
        });
        if (!result.isSuccess) { blocked = true; break; }
    }
    if (result.validationResults.length && result.isAuthorized) result = commandResult(context, {
        ...result, validationResults: result.validationResults.filter(item => item.severity > context.allowedSeverity)
    });
    return { result, blocked };
}
