// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs } from '@cratis/fundamentals';
import { currentServices } from '../dependencyInjection/ServiceScope.js';
import { fieldsFor } from '../reflection/wireSchema.js';
import type { ClassType } from '../reflection/ClassType.js';
import type { WireType } from '../reflection/WireType.js';
import type { ValidationResult } from './ValidationResult.js';
import { BaseValidator } from './BaseValidator.js';
import { evaluateRule } from './evaluateRule.js';

/** Traverse decoded models, evaluating registered validators at each distinct object. */
export class ModelGraphValidator {
    constructor(private readonly validators: ReadonlyMap<ClassType, ClassType<BaseValidator<unknown>>>,
        private readonly logger?: (error: unknown, correlationId: string) => void) {}
    async validate(model: unknown, signal: AbortSignal, rootPath = '', correlationId = ''): Promise<ValidationResult[]> {
        const results: ValidationResult[] = [];
        const visited = new WeakSet<object>();
        const walk = async (value: unknown, path: string, skip = false): Promise<void> => {
            if (value == null || typeof value !== 'object' || visited.has(value)) return;
            visited.add(value);
            if (signal.aborted) throw signal.reason ?? new Error('Validation cancelled');
            let ignored: ReadonlySet<string> | undefined;
            const type = value.constructor as ClassType;
            const validatorType = skip ? undefined : this.validators.get(type);
            if (validatorType) {
                const validator = await currentServices().resolve(validatorType);
                if (!(validator instanceof BaseValidator)) throw new Error(`Invalid validator: ${validatorType.name}`);
                ignored = validator.ignoredConceptRules;
                const resultStart = results.length;
                try {
                    for (const rule of validator.rules) {
                        let member: unknown = value;
                        for (const part of rule.path) {
                            if (member == null) { member = undefined; break; }
                            member = Reflect.get(member as object, part);
                        }
                        if (rule.kind !== 'notNull' && member instanceof ConceptAs) member = (member as ConceptAs<unknown>).value;
                        const applicable = rule.condition ? await rule.condition(value) : true;
                        if (signal.aborted) throw signal.reason ?? new Error('Validation cancelled');
                        if (!applicable) continue;
                        const valid = await evaluateRule(rule, member, value, signal);
                        if (signal.aborted) throw signal.reason ?? new Error('Validation cancelled');
                        if (valid) continue;
                        const memberPath = value instanceof ConceptAs && path ? path : [path, ...rule.path].filter(Boolean).join('.');
                        const message = typeof rule.message === 'function' ? rule.message(member, value) : rule.message ?? `The value is invalid.`;
                        const state = typeof rule.state === 'function' ? (rule.state as (model: unknown) => unknown)(value) : rule.state;
                        results.push({ severity: rule.severity, message, members: [memberPath], reason: 'rule', ...(state == null ? {} : { state }) });
                    }
                } catch (error) {
                    if (signal.aborted) throw error;
                    this.logger?.(error, correlationId);
                    results.splice(resultStart);
                    results.push({ severity: 3, message: 'The value could not be validated.', members: [], reason: 'validatorFailed' });
                }
            }
            if (value instanceof ConceptAs) return;
            if (Array.isArray(value)) {
                for (const item of value) await walk(item, path);
                return;
            }
            for (const field of fieldsFor(type as WireType)) {
                const child = Reflect.get(value, field.name);
                await walk(child, [path, field.name].filter(Boolean).join('.'), ignored?.has(field.name) && child instanceof ConceptAs);
            }
        };
        await walk(model, rootPath);
        return results;
    }
}
