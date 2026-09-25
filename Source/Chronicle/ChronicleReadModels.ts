// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IEventStore } from '@cratis/chronicle';
import type { ReadModelChangeset } from '@cratis/chronicle/readModels';
import { isPassive } from '@cratis/chronicle/projections';
import type { Constructor } from '@cratis/fundamentals';
import type { ExecutionContext } from '@cratis/arc.core';
import { from, map, Observable } from 'rxjs';
import { ChronicleRuntime } from './ChronicleRuntime.js';

/** `immediate` is only valid for passive model-bound projections; active models remain eventual. */
export type ChronicleReadConsistency = 'default' | 'immediate';

/** Tenant-scoped access to Chronicle read models; use as a service in Arc queries. */
export class ChronicleReadModels {
    constructor(private readonly runtime: ChronicleRuntime, private readonly context: ExecutionContext) {}
    /** Resolve the current tenant's event store. */
    getStore(): Promise<IEventStore> { return this.runtime.getStore(this.context); }
    /** Return null rather than fabricating a read model for an absent key. */
    async findInstanceById<T>(type: Constructor<T>, id: string, consistency: ChronicleReadConsistency = 'default'): Promise<T | null> {
        this.checkConsistency(type, consistency);
        return (await this.getStore()).readModels.findInstanceById(type, id);
    }
    /** Fetch all instances of a read model in the current tenant. */
    async getAll<T extends object>(type: Constructor<T>, consistency: ChronicleReadConsistency = 'default'): Promise<T[]> {
        this.checkConsistency(type, consistency);
        return (await this.getStore()).readModels.getInstances(type);
    }
    /** Fetch one read model by its event-source ID, or null if it does not exist. */
    getById<T extends object>(type: Constructor<T>, id: string, consistency: ChronicleReadConsistency = 'default'): Promise<T | null> {
        return this.findInstanceById(type, id, consistency);
    }
    private checkConsistency<T>(type: Constructor<T>, consistency: ChronicleReadConsistency): void {
        if (consistency !== 'default' && consistency !== 'immediate') throw new Error('Unknown Chronicle read consistency');
        if (consistency === 'immediate' && !isPassive(type))
            throw new Error('Immediate Chronicle reads require a passive model-bound projection');
    }
    /** Observe a snapshot and subsequent changes as a live list. Unsubscribe to stop watching. */
    observeAll<T extends object>(type: Constructor<T>, key: (item: T) => string = item => {
        const id = (item as { id?: unknown }).id;
        if (id === undefined || id === null) throw new Error('Observable read models require an id or a key selector');
        return String(id);
    }): Observable<T[]> {
        return this.observeSnapshot(type, key);
    }
    /** Observe one read model by its event-source ID, including removal. */
    observeById<T extends object>(type: Constructor<T>, id: string): Observable<T | null> {
        return this.observeSnapshot(type, () => id, id).pipe(map(items => items[0] ?? null));
    }
    private observeSnapshot<T extends object>(type: Constructor<T>, key: (item: T) => string, id?: string): Observable<T[]> {
        return new Observable<T[]>(subscriber => {
            let stopped = false;
            let observation: { unsubscribe(): void } | undefined;
            void (async () => {
                const items: T[] = id === undefined ? await this.getAll(type) : [];
                if (id !== undefined) {
                    const item = await this.getById(type, id);
                    if (item !== null) items.push(item);
                }
                const current = new Map(items.map(item => [key(item), item]));
                if (stopped) return;
                const emit = () => subscriber.next([...current.values()]);
                emit();
                observation = this.watch(type).subscribe({
                    next: change => {
                        if (id !== undefined && change.key !== id) return;
                        if (change.removed) current.delete(change.key);
                        else current.set(change.key, change.readModel);
                        emit();
                    },
                    error: error => subscriber.error(error)
                });
            })().catch(error => subscriber.error(error));
            return () => { stopped = true; observation?.unsubscribe(); };
        });
    }
    /** Observe the store's read-model changes for the current tenant; dispose to stop watching. */
    watch<T>(type: Constructor<T>): Observable<ReadModelChangeset<T>> {
        return from(this.watchIterable(type));
    }
    /** Iterate Chronicle changes without RxJS. */
    async *watchIterable<T>(type: Constructor<T>): AsyncIterable<ReadModelChangeset<T>> {
        yield* (await this.getStore()).readModels.watch(type);
    }
}
