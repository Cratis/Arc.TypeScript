// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';

const lateFailureReporter = new AsyncLocalStorage<(error: unknown) => void>();
/** @internal Keep the server's failure reporter available after bounded cleanup returns. */
export function withLateFailureReporter<T>(report: (error: unknown) => void, callback: () => T): T {
    return lateFailureReporter.run(report, callback);
}
/** @internal Capture reporting authority before the request scope closes. */
export function currentLateFailureReporter(): (error: unknown) => void {
    return lateFailureReporter.getStore() ?? (() => {});
}
const failures = new WeakMap<object, unknown[]>();
export function recordFailure(result: object, error: unknown, previous: object | undefined = undefined): void {
    failures.set(result, [...(previous ? failures.get(previous) ?? [] : []), error]);
}
export function hasFailure(result: object): boolean { return (failures.get(result)?.length ?? 0) > 0; }
export function originalFailure(result: object): unknown {
    const errors = failures.get(result) ?? [];
    return errors.length === 1 ? errors[0] : new AggregateError(errors, 'Arc pipeline failed');
}
