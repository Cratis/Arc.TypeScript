// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** @internal Explicit ownership of work deferred to a registry shutdown phase. */
export class ShutdownTransaction {
    readonly #release: Promise<unknown>[] = [];
    readonly #work: (() => Promise<unknown>)[] = [];
    readonly #scopes: (() => Promise<unknown>)[] = [];

    release(task: Promise<unknown>): void { this.#release.push(task); void task.catch(() => {}); }
    work(task: () => Promise<unknown>): void { this.#work.push(task); }
    scope(task: () => Promise<unknown>): void { this.#scopes.push(task); }

    async settle(phase: 'release' | 'work' | 'scopes', record: (error: unknown) => void): Promise<void> {
        if (phase === 'release') {
            for (let offset = 0; offset < this.#release.length;) {
                const batch = this.#release.slice(offset);
                offset += batch.length;
                for (const result of await Promise.allSettled(batch)) if (result.status === 'rejected') record(result.reason);
            }
            return;
        }
        const tasks = phase === 'work' ? this.#work : this.#scopes;
        for (let offset = 0; offset < tasks.length;) {
            const batch = tasks.slice(offset);
            offset += batch.length;
            for (const result of await Promise.allSettled(batch.map(task => Promise.resolve().then(task))))
                if (result.status === 'rejected') record(result.reason);
        }
    }
}
