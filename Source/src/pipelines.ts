// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { CommandDefinition, CommandResult, ExecutionContext, QueryDefinition, QueryResult, ValidationResult } from './contracts.js';
import { isOutcome } from './Outcome.js';
import { isQueryPage } from './QueryPage.js';
import { authorized } from './security.js';
import { commandResult, emptyPaging, malformed, queryResult } from './results.js';
import type { Operation } from './operation.js';
import { recordFailure } from './failures.js';

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
function compareValues(a: unknown, b: unknown): number {
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
    if (a == null || b == null) return a == null ? b == null ? 0 : -1 : 1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'bigint' && typeof b === 'bigint') return a < b ? -1 : a > b ? 1 : 0;
    if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
    return String(a).localeCompare(String(b));
}
export function commandOperation<S extends z.ZodType, T>(definition: CommandDefinition<S, T>, route: string): Operation {
    return {
        ...definition, kind: 'command', route, inputSchema: z.toJSONSchema(definition.schema),
        async run(input, context, _options, validateOnly): Promise<CommandResult> {
            if (!authorized(definition.authorization, context)) return commandResult(context, { isAuthorized: false });
            const parsed = definition.schema.safeParse(input);
            if (!parsed.success) return commandResult(context, { validationResults: malformed(context) });
            const value = parsed.data;
            try {
                if (definition.authorize && !await definition.authorize(value, context)) return commandResult(context, { isAuthorized: false });
                let issues: ValidationResult[];
                try { issues = await validate([definition.validate, ...(definition.filters ?? [])], value, context); }
                catch (error) {
                    if (context.signal.aborted) throw error;
                    const failure = commandResult(context, { validationResults: validatorFailure() });
                    recordFailure(failure, error);
                    return failure;
                }
                if (issues.length) return commandResult(context, { validationResults: issues });
                if (validateOnly) return commandResult(context);
                const scopes = [];
                let result: CommandResult = commandResult(context);
                try {
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
                            else result = commandResult(context, { response: handled.value });
                        } else result = commandResult(context, { response: handled });
                    }
                } catch (error) {
                    result = commandResult(context, { exceptionMessages: [String(error)], exceptionStackTrace: error instanceof Error ? error.stack ?? '' : '' });
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
export function queryOperation<S extends z.ZodType, T>(definition: QueryDefinition<S, T>, route: string): Operation {
    return {
        ...definition, kind: 'query', route, inputSchema: querySchema(definition.schema),
        async run(input, context, options = {}): Promise<QueryResult> {
            if (!authorized(definition.authorization, context)) return queryResult(context, { isAuthorized: false });
            const parsed = definition.schema.safeParse(input);
            if (!parsed.success) return queryResult(context, { validationResults: malformed(context) });
            try {
                const value = parsed.data;
                if (definition.authorize && !await definition.authorize(value, context)) return queryResult(context, { isAuthorized: false });
                let issues: ValidationResult[];
                try { issues = await validate([definition.validate, ...(definition.filters ?? [])], value, context); }
                catch (error) {
                    if (context.signal.aborted) throw error;
                    const failure = queryResult(context, { validationResults: validatorFailure() });
                    recordFailure(failure, error);
                    return failure;
                }
                if (issues.length) return queryResult(context, { validationResults: issues });
                const data = await definition.perform(value, context, options);
                if (isQueryPage(data)) {
                    const page = options.paging?.page ?? 0;
                    const size = options.paging?.pageSize ?? 0;
                    if (options.sorting || (!size && data.items.length !== data.totalItems) ||
                        size && data.items.length !== Math.min(size, Math.max(0, data.totalItems - page * size)))
                        return queryResult(context, { validationResults: malformed(context) });
                    return queryResult(context, { data: data.items, paging: size ? { page, size, totalItems: data.totalItems, totalPages: Math.ceil(data.totalItems / size) } : emptyPaging() });
                }
                if (Array.isArray(data)) {
                    const sorted = [...data];
                    if (options.sorting) {
                        const { field, direction } = options.sorting;
                        if (sorted.some((item: unknown) => {
                            if (!item || typeof item !== 'object') return true;
                            return !Object.hasOwn(item, field);
                        }))
                            return queryResult(context, { validationResults: malformed(context) });
                        sorted.sort((left: unknown, right: unknown) => {
                            const a = left && typeof left === 'object' ? Reflect.get(left, field) as unknown : undefined;
                            const b = right && typeof right === 'object' ? Reflect.get(right, field) as unknown : undefined;
                            const comparison = compareValues(a, b);
                            return direction === 'asc' ? comparison : -comparison;
                        });
                    }
                    const page = options.paging?.page ?? 0;
                    const size = options.paging?.pageSize ?? 0;
                    const paging = size ? { page, size, totalItems: sorted.length, totalPages: Math.ceil(sorted.length / size) } : emptyPaging();
                    return queryResult(context, { data: (size ? sorted.slice(page * size, (page + 1) * size) : sorted) as T, paging });
                }
                if (options.paging || options.sorting) return queryResult(context, { validationResults: malformed(context) });
                return queryResult(context, { data });
            } catch (error) {
                const failure = queryResult(context, { exceptionMessages: [String(error)], exceptionStackTrace: error instanceof Error ? error.stack ?? '' : '' });
                recordFailure(failure, error);
                return failure;
            }
        }
    };
}
