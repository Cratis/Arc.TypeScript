// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { CommandDefinition, CommandResult, ExecutionContext, QueryDefinition, QueryResult, ValidationResult } from './contracts.js';
import { isOutcome } from './Outcome.js';
import { authorized } from './security.js';
import { commandResult, malformed, queryResult } from './results.js';
import { renderQueryData } from './queryRendering.js';
import type { Operation } from './operation.js';
import { recordFailure } from './failures.js';
import { currentServices } from './ServiceScope.js';
import { ServiceDependencyError } from './ServiceDependencyError.js';
import { assertClientOutput } from './ClientManifest.js';
import type { ServiceToken } from './ServiceToken.js';

async function prepareDependencies(handler: readonly ServiceToken<unknown>[] = [], validators: readonly ServiceToken<unknown>[] = [], execute = true): Promise<void> {
    const scope = currentServices();
    if (!Array.isArray(handler) || !Array.isArray(validators)) throw new ServiceDependencyError('Invalid operation dependencies');
    scope.registry.preflight([...handler, ...validators]);
    await Promise.all(validators.map(token => scope.resolve(token)));
    if (execute) await Promise.all(handler.map(token => scope.resolve(token)));
}
function dependencyFailure(error: unknown): ValidationResult[] {
    return [{ severity: 3, message: 'Service dependency unavailable', members: [], reason: error instanceof ServiceDependencyError ? 'dependencyUnavailable' : 'validatorFailed' }];
}

async function validate<T>(filters: readonly (((input: T, context: ExecutionContext) => ValidationResult[] | void | Promise<ValidationResult[] | void>) | undefined)[], input: T, context: ExecutionContext): Promise<ValidationResult[]> {
    const issues: ValidationResult[] = [];
    for (const filter of filters) {
        if (!filter) continue;
        issues.push(...(await filter(input, context) ?? []).filter(item => item.severity > context.allowedSeverity));
    }
    return issues;
}
function validatorFailure(): ValidationResult[] {
    return [{ severity: 3, message: 'Validation failed', members: [], reason: 'validatorFailed' }];
}
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
function querySchema(schema: z.ZodType): Record<string, unknown> {
    const json = z.toJSONSchema(schema);
    if (schema instanceof z.ZodObject) json.required = Object.entries(schema.shape)
        .filter(([, field]) => !field.safeParse(undefined).success).map(([name]) => name);
    return json;
}
export function queryOperation<S extends z.ZodType, T>(definition: QueryDefinition<S, T>, route: string,
    observable = false): Operation {
    return {
        ...definition, kind: 'query', route, dynamicAuthorization: typeof definition.authorize === 'function', inputSchema: querySchema(definition.schema),
        async run(input, context, options = {}): Promise<QueryResult> {
            if (!authorized(definition.authorization, context)) return queryResult(context, { isAuthorized: false });
            const parsed = definition.schema.safeParse(input);
            if (!parsed.success) return queryResult(context, { validationResults: malformed(context) });
            try {
                const value = parsed.data;
                if (definition.authorize && !await definition.authorize(value, context)) return queryResult(context, { isAuthorized: false });
                let issues: ValidationResult[];
                try {
                    await prepareDependencies(definition.handlerDependencies, definition.validatorDependencies, false);
                    issues = await validate([definition.validate, ...(definition.filters ?? [])], value, context);
                } catch (error) {
                    if (context.signal.aborted) throw error;
                    const failure = queryResult(context, { validationResults: error instanceof ServiceDependencyError ? dependencyFailure(error) : validatorFailure() });
                    recordFailure(failure, error);
                    return failure;
                }
                if (issues.length) return queryResult(context, { validationResults: issues });
                await prepareDependencies(definition.handlerDependencies);
                const data = await definition.perform(value, context, options);
                return observable ? queryResult(context, { data }) : renderQueryData(definition, data, context, options);
            } catch (error) {
                const failure = queryResult(context, { exceptionMessages: [String(error)], exceptionStackTrace: error instanceof Error ? error.stack ?? '' : '', ...(error instanceof ServiceDependencyError ? { validationResults: dependencyFailure(error) } : {}) });
                recordFailure(failure, error);
                return failure;
            }
        }
    };
}
