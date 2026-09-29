// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { currentContext } from '@cratis/arc.core';

/** Records disposal order across the specification. */
export const disposals: string[] = [];

export class Dependency {
    static created = 0;
    readonly id = ++Dependency.created;
    [Symbol.dispose](): void { disposals.push(`dependency ${this.id}`); }
}

export class ActivatedReactor {
    static readonly inject = [Dependency];
    constructor(readonly dependency: Dependency) {}
    observed() { const context = currentContext()!; return { tenant: context.tenantId, correlation: context.correlationId }; }
}

export class SingletonReactor {
    [Symbol.dispose](): void { disposals.push('singleton reactor'); }
}

export class FailingCleanup {
    [Symbol.dispose](): void { throw new Error('cleanup failed'); }
}

export class ReactorWithFailingCleanup {
    static readonly inject = [FailingCleanup];
    constructor(readonly cleanup: FailingCleanup) {}
}

export class ReactorThatCannotBeConstructed {
    static readonly inject = [Dependency, FailingCleanup];
    constructor(readonly dependency: Dependency, readonly cleanup: FailingCleanup) { throw new Error('construction failed'); }
}

/** Construction waits until the specification releases the gate. */
export const construction = { gate: Promise.resolve(), started: false };

export class GatedReactor {
    constructor(readonly dependency: Dependency) {}
}

export class FailingSingleton {}

/** Keeps its activation scope so a handler can resolve services from it. */
export class ScopedReactor {
    constructor(readonly scope: { resolve<T>(token: new (...args: never[]) => T): Promise<T> }) {}
}
