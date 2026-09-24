// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Rule } from './Rule.js';

const empty = (value: unknown): boolean => value == null || value === '' || value === 0 || value === false ||
    Array.isArray(value) && !value.length || typeof value === 'string' && !value.trim();
export async function evaluateRule(rule: Rule, value: unknown, model: unknown, signal: AbortSignal): Promise<boolean> {
    const [first, second] = rule.args;
    if (signal.aborted) throw signal.reason ?? new Error('Validation cancelled');
    switch (rule.kind) {
        case 'notNull': return value != null;
        case 'null': return value == null;
        case 'notEmpty': return !empty(value);
        case 'empty': return empty(value);
        case 'minLength': return value == null || typeof value === 'string' && value.length >= (first as number);
        case 'maxLength': return value == null || typeof value === 'string' && value.length <= (first as number);
        case 'length': return value == null || typeof value === 'string' && value.length >= (first as number) && value.length <= (second as number);
        case 'greaterThan': return value == null || typeof value === 'number' && value > (first as number);
        case 'greaterThanOrEqual': return value == null || typeof value === 'number' && value >= (first as number);
        case 'lessThan': return value == null || typeof value === 'number' && value < (first as number);
        case 'lessThanOrEqual': return value == null || typeof value === 'number' && value <= (first as number);
        case 'inclusiveBetween': return value == null || typeof value === 'number' && value >= (first as number) && value <= (second as number);
        case 'exclusiveBetween': return value == null || typeof value === 'number' && value > (first as number) && value < (second as number);
        case 'equal': return value === first;
        case 'notEqual': return value !== first;
        case 'emailAddress': return value == null || typeof value === 'string' && /^[^@\s]+@[^@\s]+$/.test(value);
        case 'phone': return value == null || typeof value === 'string' && /^\+?[\d\s().-]{7,}$/.test(value);
        case 'url': return value == null || typeof value === 'string' && /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(value);
        case 'matches': return value == null || typeof value === 'string' && new RegExp((first as RegExp).source, (first as RegExp).flags).test(value);
        case 'must': return (first as (value: unknown, model: unknown, signal: AbortSignal) => boolean)(value, model, signal);
        case 'mustAsync': return await (first as (value: unknown, model: unknown, signal: AbortSignal) => Promise<boolean>)(value, model, signal);
        default: throw new Error(`Unsupported validation rule: ${rule.kind}`);
    }
}
