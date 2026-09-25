// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcOptions } from '../ArcOptions.js';
import { currentServices } from '../dependencyInjection/ServiceScope.js';
import { throwIfCanceled } from '../execution/throwIfCanceled.js';
import { commandResult } from './createCommandResult.js';
import type { CommandContext } from './CommandContext.js';
import type { CommandResponseValueHandler } from './CommandResponseValueHandler.js';
import type { CommandExecutionScope } from './CommandExecutionScope.js';
import { isCommandOperation } from './CommandOperation.js';
import { isCommandOperations } from './CommandOperations.js';
import { CommandOperationBoundary } from './CommandOperationBoundary.js';
import { CommandOperationExecution } from './CommandOperationExecution.js';
import { flattenCommandResponse, processCommandResponse } from './processCommandResponse.js';
/** Classify the response, preflight all declarations, then invoke scoped value handlers. */
export async function prepareCommandResponse(value: unknown, context: CommandContext, scopes: readonly CommandExecutionScope[],
    options: ArcOptions) {
    const leaves = flattenCommandResponse(value);
    const declarations = leaves.flatMap(item => isCommandOperation(item) ? [item] :
        isCommandOperations(item) ? [...item.values] : []);
    let journal: CommandOperationExecution | undefined;
    if (declarations.length || leaves.some(isCommandOperations)) {
        CommandOperationBoundary.validate();
        if (scopes.some(scope => !('getCommitDisposition' in scope) || !('isCommitParticipant' in scope)))
            throw new Error('Command operations require explicitly compatible execution scopes');
        journal = await CommandOperationExecution.plan(declarations, options.commandCompensationTimeoutMs ?? 30_000);
    }
    const tokens = [...options.commandResponseValueHandlers ?? []].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    if (tokens.some((token, index) => index > 0 && token.name === tokens[index - 1]!.name))
        throw new Error('Command response handler names must be unique for deterministic ordering');
    try {
        const handlers: CommandResponseValueHandler[] = [];
        for (const token of tokens) {
            throwIfCanceled(context, 'Command canceled');
            handlers.push(await currentServices().resolve(token));
            throwIfCanceled(context, 'Command canceled');
        }
        if (journal) for (const value of leaves) for (const handler of handlers) {
            throwIfCanceled(context, 'Command canceled');
            if (!handler.incompatibleWithOperations) continue;
            const matches = await handler.canHandle(context, value);
            throwIfCanceled(context, 'Command canceled');
            if (matches) throw new Error('Chronicle returned events cannot be combined with command operations');
        }
        const result = await processCommandResponse(context, leaves, handlers, journal !== undefined);
        return { result, journal };
    } catch (error) {
        // Retain the preflighted journal for scope completion and recovery on failure.
        return { result: commandResult(context), journal, failure: { error } };
    }
}
