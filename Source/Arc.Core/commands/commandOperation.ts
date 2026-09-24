// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { CommandDefinition, CommandResult, ValidationResult } from '../index.js';
import { isOutcome } from '../results/Outcome.js';
import { authorized } from '../authorization/authorized.js';
import { commandResult } from '../results/commandResult.js';
import { malformed } from '../results/malformed.js';
import type { Operation } from '../http/Operation.js';
import { recordFailure } from '../results/failureTracking.js';
import { ServiceDependencyError } from '../dependencyInjection/ServiceDependencyError.js';
import { assertClientOutput } from '../introspection/ClientManifest.js';
import { prepareDependencies, dependencyFailure, validate, validatorFailure } from './OperationValidation.js';

export function commandOperation<S extends z.ZodType, T>(definition: CommandDefinition<S, T>, route: string): Operation {
    return {
        ...definition, kind: 'command', route, dynamicAuthorization: typeof definition.authorize === 'function', inputSchema: z.toJSONSchema(definition.schema),
        async run(input, context, _options, validateOnly): Promise<CommandResult> {
            if (!authorized(definition.authorization, context)) return commandResult(context, { isAuthorized: false });
            const parsed = definition.schema.safeParse(input);
            if (!parsed.success) return commandResult(context, { validationResults: malformed(context) });
            const value = parsed.data;
            try {
                if (definition.authorize && !await definition.authorize(value, context)) return commandResult(context, { isAuthorized: false });
                let issues: ValidationResult[];
                try {
                    await prepareDependencies(definition.handlerDependencies, definition.validatorDependencies, false);
                    issues = await validate([definition.validate, ...(definition.filters ?? [])], value, context);
                } catch (error) {
                    if (context.signal.aborted) throw error;
                    const failure = commandResult(context, { validationResults: error instanceof ServiceDependencyError ? dependencyFailure(error) : validatorFailure() });
                    recordFailure(failure, error);
                    return failure;
                }
                if (issues.length) return commandResult(context, { validationResults: issues });
                if (validateOnly) return commandResult(context);
                const scopes = [];
                let result: CommandResult = commandResult(context);
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
                            }
                            else provided = provided.value;
                        }
                    }
                    if (result.isSuccess) {
                        const handled = await definition.handle(value, context, provided);
                        if (isOutcome(handled)) {
                            if (handled.kind === 'denied') result = commandResult(context, { isAuthorized: false, authorizationFailureReason: handled.reason });
                            else if (handled.kind === 'validation') result = commandResult(context, { validationResults: handled.results.filter(item => item.severity > context.allowedSeverity) });
                            else {
                                const response = definition.clientOutput ? assertClientOutput(definition.clientOutput.output, handled.value) : handled.value;
                                result = commandResult(context, { response });
                            }
                        } else {
                            const response = definition.clientOutput ? assertClientOutput(definition.clientOutput.output, handled) : handled;
                            result = commandResult(context, { response });
                        }
                    }
                } catch (error) {
                    result = commandResult(context, { exceptionMessages: [String(error)], exceptionStackTrace: error instanceof Error ? error.stack ?? '' : '', ...(error instanceof ServiceDependencyError ? { validationResults: dependencyFailure(error) } : {}) });
                    recordFailure(result, error);
                } finally {
                    for (const scope of scopes.reverse()) {
                        try { await scope.complete(context, result); }
                        catch (error) {
                            const previous = result;
                            result = commandResult(context, { ...previous, response: undefined, exceptionMessages: [...previous.exceptionMessages, String(error)] });
                            recordFailure(result, error, previous);
                        }
                    }
                }
                // A completion callback receives the result and can replace its response.
                // Recheck that final value, not the handler's original object, before returning.
                if (definition.clientOutput && result.isSuccess) {
                    try { result.response = assertClientOutput(definition.clientOutput.output, result.response); }
                    catch (error) {
                        const previous = result;
                        result = commandResult(context, { exceptionMessages: [String(error)], exceptionStackTrace: error instanceof Error ? error.stack ?? '' : '' });
                        recordFailure(result, error, previous);
                    }
                }
                return result;
            } catch (error) {
                const failure = commandResult(context, { exceptionMessages: [String(error)], exceptionStackTrace: error instanceof Error ? error.stack ?? '' : '' });
                recordFailure(failure, error);
                return failure;
            }
        }
    };
}
