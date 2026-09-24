// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Demo-only in-memory storage; use a durable store for a real application. */
export class TaskRepository {
    readonly #tasks = new Map<string, string>();
    save(id: string, title: string): void { this.#tasks.set(id, title); }
    list(search: string): { id: string; title: string }[] {
        return [...this.#tasks].filter(([, title]) => title.includes(search)).map(([id, title]) => ({ id, title }));
    }
}
