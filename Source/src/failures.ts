// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
const failures = new WeakMap<object, unknown[]>();
export function recordFailure(result: object, error: unknown, previous: object | undefined = undefined): void {
    failures.set(result, [...(previous ? failures.get(previous) ?? [] : []), error]);
}
export function hasFailure(result: object): boolean { return (failures.get(result)?.length ?? 0) > 0; }
export function originalFailure(result: object): unknown {
    const errors = failures.get(result) ?? [];
    return errors.length === 1 ? errors[0] : new AggregateError(errors, 'Arc pipeline failed');
}
