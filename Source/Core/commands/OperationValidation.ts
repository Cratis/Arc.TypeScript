// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext, ValidationResult } from '../index.js';
import { currentServices } from '../dependencyInjection/ServiceScope.js';
import { ServiceDependencyError } from '../dependencyInjection/ServiceDependencyError.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';

export async function prepareDependencies(handler: readonly ServiceIdentifier<unknown>[] = [], validators: readonly ServiceIdentifier<unknown>[] = [], execute = true): Promise<void> {
    const scope = currentServices();
    if (!Array.isArray(handler) || !Array.isArray(validators)) throw new ServiceDependencyError('Invalid operation dependencies');
    scope.registry.preflight([...handler, ...validators]);
    await Promise.all(validators.map(token => scope.resolve(token)));
    if (execute) await Promise.all(handler.map(token => scope.resolve(token)));
}
export function dependencyFailure(error: unknown): ValidationResult[] {
    return [{ severity: 3, message: 'Service dependency unavailable', members: [], reason: error instanceof ServiceDependencyError ? 'dependencyUnavailable' : 'validatorFailed' }];
}

export async function validate<T>(filters: readonly (((input: T, context: ExecutionContext) => ValidationResult[] | void | Promise<ValidationResult[] | void>) | undefined)[], input: T, context: ExecutionContext): Promise<ValidationResult[]> {
    const issues: ValidationResult[] = [];
    for (const filter of filters) {
        if (!filter) continue;
        issues.push(...(await filter(input, context) ?? []).filter(item => item.severity > context.allowedSeverity));
    }
    return issues;
}
export function validatorFailure(): ValidationResult[] {
    return [{ severity: 3, message: 'Validation failed', members: [], reason: 'validatorFailed' }];
}
