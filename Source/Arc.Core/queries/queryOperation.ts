// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { QueryDefinition, QueryResult, ValidationResult } from '../index.js';
import { authorized } from '../authorization/authorized.js';
import { queryResult } from '../results/queryResult.js';
import { malformed } from '../results/malformed.js';
import { renderQueryData } from './queryRendering.js';
import type { Operation } from '../http/Operation.js';
import { recordFailure } from '../results/failureTracking.js';
import { ServiceDependencyError } from '../dependencyInjection/ServiceDependencyError.js';
import { prepareDependencies, dependencyFailure, validate, validatorFailure } from '../commands/OperationValidation.js';
import { InvalidQuerySort } from './InvalidQuerySort.js';
import { validation } from '../validation/ValidationResult.js';

function querySchema(schema: z.ZodType): Record<string, unknown> {
    const json = z.toJSONSchema(schema);
    if (schema instanceof z.ZodObject) json.required = Object.entries(schema.shape)
        .filter(([, field]) => !field.safeParse(undefined).success).map(([name]) => name);
    return json;
}
export function queryOperation<S extends z.ZodType, T>(definition: QueryDefinition<S, T>, route: string,
    observable = false): Operation {
    return {
        ...definition, kind: 'query', route, dynamicAuthorization: typeof definition.authorize === 'function', inputSchema: definition.wireInputSchema ?? querySchema(definition.schema),
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
                if (error instanceof InvalidQuerySort) return queryResult(context, {
                    validationResults: [validation(error.message, ['sorting.field'])]
                });
                const failure = queryResult(context, { exceptionMessages: [String(error)], exceptionStackTrace: error instanceof Error ? error.stack ?? '' : '', ...(error instanceof ServiceDependencyError ? { validationResults: dependencyFailure(error) } : {}) });
                recordFailure(failure, error);
                return failure;
            }
        }
    };
}
