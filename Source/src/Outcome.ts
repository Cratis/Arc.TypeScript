// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ValidationResult } from './ValidationResult.js';
const outcomeBrand: unique symbol = Symbol('Arc outcome');
export type Outcome<T> =
    | { kind: 'response'; value: T; readonly [outcomeBrand]: true }
    | { kind: 'validation'; results: ValidationResult[]; readonly [outcomeBrand]: true }
    | { kind: 'denied'; reason?: string; readonly [outcomeBrand]: true };
export const isOutcome = (value: unknown): value is Outcome<unknown> =>
    !!value && typeof value === 'object' && Reflect.get(value, outcomeBrand) === true;
export const response = <T>(value: T): Outcome<T> => ({ kind: 'response', value, [outcomeBrand]: true });
export const rejected = (...results: ValidationResult[]): Outcome<never> => {
    if (!results.length) throw new Error('A rejection requires at least one validation result');
    return { kind: 'validation', results, [outcomeBrand]: true };
};
export const denied = (reason = ''): Outcome<never> => ({ kind: 'denied', reason, [outcomeBrand]: true });
