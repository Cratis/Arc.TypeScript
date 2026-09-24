// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IEventStore } from '@cratis/chronicle';
import type { ReadModelChangeset } from '@cratis/chronicle/readModels';
import type { Constructor } from '@cratis/fundamentals';
import type { ExecutionContext } from '@cratis/arc.core';
import { ChronicleRuntime } from './ChronicleRuntime.js';

/** Tenant-scoped access to Chronicle read models; use as a service in Arc queries. */
export class ChronicleReadModels {
    constructor(private readonly runtime: ChronicleRuntime, private readonly context: ExecutionContext) {}
    /** Resolve the current tenant's event store. */
    getStore(): Promise<IEventStore> { return this.runtime.getStore(this.context); }
    /** Return null rather than fabricating a read model for an absent key. */
    async findInstanceById<T>(type: Constructor<T>, id: string): Promise<T | null> {
        return (await this.getStore()).readModels.findInstanceById(type, id);
    }
    /** Observe the store's read-model changes for the current tenant. */
    async *watch<T>(type: Constructor<T>): AsyncIterable<ReadModelChangeset<T>> {
        yield* (await this.getStore()).readModels.watch(type);
    }
}
