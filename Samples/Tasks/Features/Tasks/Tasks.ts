// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ObservableSource } from '@cratis/arc.core';
import type { TaskItem } from './Listing/TaskItem.js';
import { TaskId } from './TaskId.js';
import { TaskTitle } from './TaskTitle.js';

/** Demonstration-only in-memory storage. */
export class Tasks {
    readonly #items = new Map<string, TaskItem>();
    readonly #observers = new Set<(items: TaskItem[]) => void>();
    register(id: TaskId, title: TaskTitle): void {
        this.#items.set(id.toString(), { id, title } as TaskItem);
        for (const observer of this.#observers) observer(this.all());
    }
    all(): TaskItem[] { return [...this.#items.values()]; }
    byId(id: TaskId): TaskItem | undefined { return this.#items.get(id.toString()); }
    observeAll(): ObservableSource<TaskItem[]> {
        return {
            current: () => ({ hasValue: true, value: this.all() }),
            subscribe: observer => {
                const next = (items: TaskItem[]) => observer.next(items);
                this.#observers.add(next);
                return { unsubscribe: () => { this.#observers.delete(next); } };
            }
        };
    }
}
