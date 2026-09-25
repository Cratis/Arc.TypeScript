// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { ArcOptions } from '../ArcOptions.js';
import { ServiceDependencyError } from '../dependencyInjection/ServiceDependencyError.js';
import { recordFailure } from '../execution/failureTracking.js';
import { throwIfCanceled } from '../execution/throwIfCanceled.js';
import { assertClientOutput } from '../introspection/ClientManifest.js';
import { isOutcome } from './Outcome.js';
import { isCommandOperation } from './CommandOperation.js';
import { isCommandOperations } from './CommandOperations.js';
import { hasAcknowledgedCommandCommit } from './acknowledgeCommandCommit.js';
import type { CommandDefinition } from './CommandDefinition.js';
import type { CommandContext } from './CommandContext.js';
import { CommandFailureSnapshot } from './CommandFailureSnapshot.js';
import { CommandCommitDisposition } from './CommandCommitDisposition.js';
import { CommandOperationFailureSource } from './CommandOperationFailureSource.js';
import type { CommandExecutionScope, CommandOperationExecutionScope } from './CommandExecutionScope.js';
import { CommandOperationExecution } from './CommandOperationExecution.js';
import type { CommandResult } from './CommandResult.js';
import { commandResult } from './createCommandResult.js';
import { prepareDependencies, dependencyFailure, validate, validatorFailure } from './OperationValidation.js';
import { prepareCommandResponse } from './prepareCommandResponse.js';
import { flattenCommandResponse, processCommandResponse } from './processCommandResponse.js';
import { setCommandRecovery } from './commandRecovery.js';
import { observe } from '../execution/observability.js';
import { fullyQualifiedName } from '../http/fullyQualifiedName.js';
import { ReadModelForCommandError } from './ReadModelForCommandError.js';

function disposition(scopes: readonly CommandExecutionScope[], context: CommandContext): CommandCommitDisposition {
    const participants = scopes.filter((scope): scope is CommandOperationExecutionScope =>
        'isCommitParticipant' in scope && scope.isCommitParticipant === true);
    if (participants.length > 1) throw new Error('Operations support at most one deferred commit participant');
    const value = participants[0]?.getCommitDisposition(context) ?? CommandCommitDisposition.NoCommit;
    if (![CommandCommitDisposition.NoCommit, CommandCommitDisposition.NotCommitted, CommandCommitDisposition.Committed,
        CommandCommitDisposition.Unknown, CommandCommitDisposition.Mixed].includes(value))
        throw new Error('Invalid command commit disposition');
    return value;
}

/** Build a failed command result, merging any preceding result. */
export function commandFailure(context: CommandContext, error: unknown, previous?: CommandResult): CommandResult {
    const result = commandResult(context, { isAuthorized: previous?.isAuthorized,
        validationResults: [...previous?.validationResults ?? [],
            ...(error instanceof ServiceDependencyError ? dependencyFailure(error) : []),
            ...(error instanceof ReadModelForCommandError ?
                [{ severity: 3, message: error.message, members: [], reason: 'rule' as const }] : [])],
        authorizationFailureReason: previous?.authorizationFailureReason,
        exceptionMessages: [...previous?.exceptionMessages ?? [],
            ...(error instanceof ReadModelForCommandError ? [] : [String(error)])],
        exceptionStackTrace: error instanceof Error ? error.stack ?? '' : previous?.exceptionStackTrace });
    recordFailure(result, error, previous);
    return result;
}

async function preflight<S extends z.ZodType, T>(definition: CommandDefinition<S, T>, value: z.output<S>,
    context: CommandContext): Promise<CommandResult | undefined> {
    try {
        throwIfCanceled(context, 'Command canceled');
        await prepareDependencies(definition.handlerDependencies, definition.validatorDependencies, false);
        throwIfCanceled(context, 'Command canceled');
        const issues = await observe('cratis.arc.command.filter', context.correlationId,
            { command_type: fullyQualifiedName(definition) }, () =>
                validate([definition.validate, ...(definition.filters ?? [])], value, context));
        throwIfCanceled(context, 'Command canceled');
        if (issues.length) return commandResult(context, { validationResults: issues });
    } catch (error) {
        if (context.signal.aborted) throw context.signal.reason ?? error;
        const result = commandResult(context, {
            validationResults: error instanceof ServiceDependencyError ? dependencyFailure(error) : validatorFailure()
        });
        recordFailure(result, error);
        return result;
    }
}

async function handle<S extends z.ZodType, T>(definition: CommandDefinition<S, T>, value: z.output<S>, context: CommandContext,
    scopes: CommandExecutionScope[], options: ArcOptions): Promise<{
        result: CommandResult; journal?: CommandOperationExecution; prepared: boolean; failure?: { error: unknown }
    }> {
    throwIfCanceled(context, 'Command canceled');
    await prepareDependencies(definition.handlerDependencies);
    throwIfCanceled(context, 'Command canceled');
    for (const create of [...options.commandExecutionScopes ?? [], ...definition.scopes ?? []]) {
        throwIfCanceled(context, 'Command canceled');
        const scope = create();
        scopes.push(scope);
        await scope.begin(context);
        throwIfCanceled(context, 'Command canceled');
    }
    let provided: unknown;
    let result: CommandResult = commandResult(context);
    if (definition.provide) {
        throwIfCanceled(context, 'Command canceled');
        provided = await definition.provide(value, context);
        throwIfCanceled(context, 'Command canceled');
        if (isOutcome(provided)) {
            if (provided.kind === 'denied') result = commandResult(context,
                { isAuthorized: false, authorizationFailureReason: provided.reason });
            else if (provided.kind === 'validation') {
                result = commandResult(context, {
                    validationResults: provided.results.filter(item => item.severity > context.allowedSeverity)
                });
                provided = undefined;
            } else provided = provided.value;
        }
    }
    if (!result.isSuccess) return { result, prepared: false };
    throwIfCanceled(context, 'Command canceled');
    const handled = await definition.handle(value, context, provided);
    if (context.signal.aborted && (hasAcknowledgedCommandCommit(context) || !options.commandResponseValueHandlers?.length)) {
        const leaves = flattenCommandResponse(handled);
        if (!leaves.some(item => isCommandOperation(item) || isCommandOperations(item))) {
            // Classify the completed handler's result without starting response handlers after cancellation.
            const response = await processCommandResponse(context, leaves, [], false);
            return { result: response, prepared: true };
        }
    }
    throwIfCanceled(context, 'Command canceled');
    const { result: response, journal, failure } = await prepareCommandResponse(handled, context, scopes, options);
    return { result: response, journal, prepared: true, failure };
}

async function completeScopes<S extends z.ZodType, T>(definition: CommandDefinition<S, T>, context: CommandContext,
    scopes: CommandExecutionScope[], snapshot: CommandFailureSnapshot, journal: CommandOperationExecution | undefined,
    result: CommandResult, source: CommandOperationFailureSource): Promise<CommandResult> {
    for (const scope of scopes.reverse()) {
        if (journal) result = snapshot.restore(result);
        try { await scope.complete(context, result); }
        catch (error) {
            if (!snapshot.original) source = CommandOperationFailureSource.ScopeCompletion;
            result = commandFailure(context, error, result);
        }
        snapshot.capture(result);
    }
    if (journal) result = snapshot.restore(result);
    if (definition.clientOutput && result.isSuccess) {
        try { result.response = assertClientOutput(definition.clientOutput.output, result.response); }
        catch (error) { result = commandFailure(context, error, result); snapshot.capture(result); }
    }
    if (journal) {
        let commit: CommandCommitDisposition = CommandCommitDisposition.Unknown;
        try { commit = disposition(scopes, context); }
        catch (error) { result = commandFailure(context, error, result); snapshot.capture(result); }
        if (result.isSuccess && (commit === CommandCommitDisposition.Unknown || commit === CommandCommitDisposition.Mixed)) {
            result = commandFailure(context, new Error(`Command commit disposition is ${commit}`), result);
            snapshot.capture(result);
        }
        const messages = snapshot.original?.exceptionMessages ?? result.exceptionMessages;
        const recovery = await journal.recover(commit, !result.isSuccess && !messages.length ? ['Command failed'] : messages, source);
        setCommandRecovery(result, recovery, journal.outcomes);
    }
    return result;
}

/** Execute a validated command with its scopes and compensation journal. */
export async function executeCommandOperation<S extends z.ZodType, T>(definition: CommandDefinition<S, T>, value: z.output<S>,
    context: CommandContext, options: ArcOptions, validateOnly: boolean): Promise<CommandResult> {
    try {
        throwIfCanceled(context, 'Command canceled');
        const rejected = await preflight(definition, value, context);
        if (rejected) return rejected;
        throwIfCanceled(context, 'Command canceled');
        if (validateOnly) return commandResult(context);
        const scopes: CommandExecutionScope[] = [];
        let result: CommandResult = commandResult(context);
        let journal: CommandOperationExecution | undefined;
        let source: CommandOperationFailureSource = CommandOperationFailureSource.ResponseHandling;
        const snapshot = new CommandFailureSnapshot(context);
        try {
            const handled = await handle(definition, value, context, scopes, options);
            ({ result, journal } = handled);
            if (handled.failure) throw handled.failure.error;
            if (handled.prepared) {
                if (definition.encodeResponse && result.isSuccess) result.response = definition.encodeResponse(result.response);
                if (definition.clientOutput && result.isSuccess)
                    result.response = assertClientOutput(definition.clientOutput.output, result.response);
                snapshot.capture(result);
            }
            if (journal && result.isSuccess) {
                throwIfCanceled(context, 'Command canceled');
                const before = disposition(scopes, context);
                if (before !== CommandCommitDisposition.NoCommit && before !== CommandCommitDisposition.NotCommitted)
                    throw new Error('Operations cannot start after an early, unknown, or mixed business commit');
                source = CommandOperationFailureSource.Execution;
                throwIfCanceled(context, 'Command canceled');
                await journal.execute(context);
            }
        } catch (error) {
            source = context.signal.aborted ? CommandOperationFailureSource.Cancellation : source;
            result = commandFailure(context, error, result);
            snapshot.capture(result);
        } finally {
            result = await completeScopes(definition, context, scopes, snapshot, journal, result, source);
        }
        if (!result.isSuccess) result.response = undefined;
        return result;
    } catch (error) { return commandFailure(context, error); }
}
