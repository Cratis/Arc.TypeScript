// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { ArcServerOptions } from '../ArcServerOptions.js';
import type { CommandDefinition, CommandResult, ValidationResult } from '../index.js';
import { isOutcome } from '../results/Outcome.js';
import { authorized } from '../authorization/authorized.js';
import { commandResult } from '../results/commandResult.js';
import { malformed } from '../results/malformed.js';
import type { Operation } from '../http/Operation.js';
import { recordFailure } from '../results/failureTracking.js';
import { CommandFailureSnapshot } from './CommandFailureSnapshot.js';
import { ServiceDependencyError } from '../dependencyInjection/ServiceDependencyError.js';
import { ReadModelForCommandError } from './ReadModelForCommandError.js';
import { assertClientOutput } from '../introspection/ClientManifest.js';
import { prepareDependencies, dependencyFailure, validate, validatorFailure } from './OperationValidation.js';
import { createCommandContext } from './createCommandContext.js';
import { CommandContextValues } from './CommandContextValues.js';
import { prepareCommandResponse } from './prepareCommandResponse.js';
import { CommandOperationExecution } from './CommandOperationExecution.js';
import { setCommandRecovery } from './commandRecovery.js';
import type { CommandExecutionScope, CommandOperationExecutionScope } from './CommandExecutionScope.js';
import type { CommandCommitDisposition } from './CommandCommitDisposition.js';
import type { CommandContext } from './CommandContext.js';
import { observe } from '../observability.js';

function disposition(scopes: readonly CommandExecutionScope[], context: CommandContext): CommandCommitDisposition {
    const participants = scopes.filter((scope): scope is CommandOperationExecutionScope =>
        'isCommitParticipant' in scope && scope.isCommitParticipant === true);
    if (participants.length > 1) throw new Error('Operations support at most one deferred commit participant');
    const value = participants[0]?.getCommitDisposition(context) ?? 'NoCommit';
    if (!['NoCommit', 'NotCommitted', 'Committed', 'Unknown', 'Mixed'].includes(value))
        throw new Error('Invalid command commit disposition');
    return value;
}
function failure(context: CommandContext, error: unknown, previous?: CommandResult): CommandResult {
    const result = commandResult(context, { isAuthorized: previous?.isAuthorized,
        validationResults: [...previous?.validationResults ?? [], ...(error instanceof ServiceDependencyError ? dependencyFailure(error) : []),
            ...(error instanceof ReadModelForCommandError ? [{ severity: 3, message: error.message, members: [], reason: 'rule' as const }] : [])],
        authorizationFailureReason: previous?.authorizationFailureReason,
        exceptionMessages: [...previous?.exceptionMessages ?? [], ...(error instanceof ReadModelForCommandError ? [] : [String(error)])],
        exceptionStackTrace: error instanceof Error ? error.stack ?? '' : previous?.exceptionStackTrace });
    recordFailure(result, error, previous);
    return result;
}
/** Compile a command into the shared direct and HTTP execution pipeline. */
export function commandOperation<S extends z.ZodType, T>(definition: CommandDefinition<S, T>, route: string, options: ArcServerOptions = {}): Operation {
    return {
        ...definition, kind: 'command', route, dynamicAuthorization: typeof definition.authorize === 'function', inputSchema: definition.wireInputSchema ?? z.toJSONSchema(definition.schema),
        async run(input, execution, _options, validateOnly): Promise<CommandResult> {
            if (!await authorized(definition.authorization, execution, options.authorizationPolicies ?? {}, definition, input)) return commandResult(execution, { isAuthorized: false });
            const parsed = definition.schema.safeParse(input);
            if (!parsed.success) return commandResult(execution, { validationResults: malformed(execution) });
            const value = parsed.data;
            try {
                if (definition.authorize && !await definition.authorize(value, execution)) return commandResult(execution, { isAuthorized: false });
            } catch (error) { return failure({ ...execution, command: value, key: undefined, values: new CommandContextValues() }, error); }
            let context: CommandContext;
            try { context = await createCommandContext(definition.commandFactory?.(value) ?? value, execution, options); }
            catch (error) { return failure({ ...execution, command: value, key: undefined, values: new CommandContextValues() }, error); }
            const execute = async (): Promise<CommandResult> => {
                try {
                let issues: ValidationResult[];
                try {
                    await prepareDependencies(definition.handlerDependencies, definition.validatorDependencies, false);
                    issues = await observe('cratis.arc.command.filter',
                        context.correlationId, { command_type: [definition.namespace, definition.name].filter(Boolean).join('.') }, () =>
                            validate([definition.validate, ...(definition.filters ?? [])], value, context));
                } catch (error) {
                    if (context.signal.aborted) throw error;
                    const result = commandResult(context, { validationResults: error instanceof ServiceDependencyError ? dependencyFailure(error) : validatorFailure() });
                    recordFailure(result, error);
                    return result;
                }
                if (issues.length) return commandResult(context, { validationResults: issues });
                if (validateOnly) return commandResult(context);
                const scopes: CommandExecutionScope[] = [];
                let result: CommandResult = commandResult(context);
                let journal: CommandOperationExecution | undefined;
                let source: 'response' | 'execution' | 'cancellation' | 'scope' = 'response';
                const snapshot = new CommandFailureSnapshot(context);
                try {
                    await prepareDependencies(definition.handlerDependencies);
                    for (const create of definition.scopes ?? []) {
                        const scope = create();
                        scopes.push(scope);
                        await scope.begin(context);
                    }
                    let provided: unknown;
                    if (definition.provide) {
                        provided = await definition.provide(value, context);
                        if (isOutcome(provided)) {
                            if (provided.kind === 'denied') result = commandResult(context, { isAuthorized: false, authorizationFailureReason: provided.reason });
                            else if (provided.kind === 'validation') {
                                result = commandResult(context, { validationResults: provided.results.filter(item => item.severity > context.allowedSeverity) });
                                provided = undefined;
                            } else provided = provided.value;
                        }
                    }
                    if (result.isSuccess) {
                        ({ result, journal } = await prepareCommandResponse(
                            await definition.handle(value, context, provided), context, scopes, options));
                        if (definition.encodeResponse && result.isSuccess) result.response = definition.encodeResponse(result.response);
                        if (definition.clientOutput && result.isSuccess) {
                            result.response = assertClientOutput(definition.clientOutput.output, result.response);
                        }
                        snapshot.capture(result);
                        if (journal && result.isSuccess) {
                            const before = disposition(scopes, context);
                            if (before !== 'NoCommit' && before !== 'NotCommitted')
                                throw new Error('Operations cannot start after an early, unknown, or mixed business commit');
                            source = 'execution';
                            await journal.execute(context);
                        }
                    }
                } catch (error) {
                    source = context.signal.aborted ? 'cancellation' : source;
                    result = failure(context, error, result);
                    snapshot.capture(result);
                } finally {
                    for (const scope of scopes.reverse()) {
                        if (journal) result = snapshot.restore(result);
                        try { await scope.complete(context, result); }
                        catch (error) {
                            if (!snapshot.original) source = 'scope';
                            result = failure(context, error, result);
                        }
                        snapshot.capture(result);
                    }
                    if (journal) result = snapshot.restore(result);
                    if (definition.clientOutput && result.isSuccess) {
                        try {
                            result.response = assertClientOutput(definition.clientOutput.output, result.response);
                        } catch (error) { result = failure(context, error, result); snapshot.capture(result); }
                    }
                    if (journal) {
                        let commit: CommandCommitDisposition = 'Unknown';
                        try { commit = disposition(scopes, context); }
                        catch (error) { result = failure(context, error, result); snapshot.capture(result); }
                        if (result.isSuccess && (commit === 'Unknown' || commit === 'Mixed')) {
                            result = failure(context, new Error(`Command commit disposition is ${commit}`), result);
                            snapshot.capture(result);
                        }
                        const messages = snapshot.original?.exceptionMessages ?? result.exceptionMessages;
                        const recovery = await journal.recover(commit, !result.isSuccess && !messages.length ?
                            ['Command failed'] : messages, source);
                        setCommandRecovery(result, recovery, journal.outcomes);
                    }
                }
                if (!result.isSuccess) result.response = undefined;
                return result;
                } catch (error) { return failure(context, error); }
            };
            return options.commandExecutionRunner ? options.commandExecutionRunner(context, execute) : execute();
        }
    };
}
