// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BehaviorSubject } from 'rxjs';
import type { TaskItem } from './Listing/TaskItem.js';
import { TaskId } from './TaskId.js';
import { TaskTitle } from './TaskTitle.js';

/** Demonstration-only in-memory storage. */
export class Tasks {
    readonly #items = new Map<string, TaskItem>();
    readonly #changes = new BehaviorSubject<TaskItem[]>([]);
    register(id: TaskId, title: TaskTitle): void {
        this.#items.set(id.toString(), { id, title });
        this.#changes.next(this.all());
    }
    all(): TaskItem[] { return [...this.#items.values()]; }
    byId(id: TaskId): TaskItem | undefined { return this.#items.get(id.toString()); }
    observeAll(): BehaviorSubject<TaskItem[]> { return this.#changes; }
}
