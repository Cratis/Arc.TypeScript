// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { EventSequenceNumber } from '@cratis/chronicle/eventSequences';
import type { ConcurrencyScope, EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import { AggregateRootCommitResult } from './AggregateRootCommitResult.js';
import type { EventContext } from '@cratis/chronicle/events';

type EventClass<T extends object = object> = new (...args: never[]) => T;
export const rehydrateAggregate = Symbol('rehydrate aggregate');

/** Rehydrated state and pending events for one Chronicle event source. */
export class AggregateRoot {
    #sourceId?: string;
    #pending: EventForEventSourceId[] = [];
    #staged = 0;
    #tail = EventSequenceNumber.beforeFirst.value;
    #route: Omit<ConcurrencyScope, 'eventSourceId' | 'sequenceNumber'> = {};
    #handlers = new Map<EventClass, (event: object, context?: EventContext) => void>();
    /** True when no recorded events were found for the selected event source. */
    protected isNew = true;
    /** Register a handler by event type, independent of the class or method name. */
    protected on<T extends object>(type: EventClass<T>, handler: (event: T, context?: EventContext) => void): void {
        if (this.#handlers.has(type)) throw new Error('An aggregate event type can only have one handler');
        this.#handlers.set(type, handler as (event: object, context?: EventContext) => void);
    }
    /** @internal */
    get eventTypes(): EventClass[] { return [...this.#handlers.keys()]; }
    /** @internal */
    [rehydrateAggregate](sourceId: string, tail: bigint, route: Omit<ConcurrencyScope, 'eventSourceId' | 'sequenceNumber'>,
        events: readonly { type: EventClass; content: object; context: EventContext }[]): void {
        if (this.#sourceId) throw new Error('An aggregate can only be rehydrated once');
        this.#sourceId = sourceId;
        this.#tail = tail;
        this.#route = route;
        this.isNew = tail === EventSequenceNumber.beforeFirst.value || tail === EventSequenceNumber.unset.value;
        for (const entry of events) this.#dispatch(entry.type, Object.assign(Object.create(entry.type.prototype) as object, entry.content), entry.context);
    }
    /** Apply a registered event to in-memory state and stage it for commit. */
    apply(event: object): void {
        if (!this.#sourceId) throw new Error('The aggregate is not active');
        this.#dispatch(event.constructor as EventClass, event);
        this.#pending.push({ eventSourceId: this.#sourceId, event });
    }
    /** Return pending events; events not returned are also enrolled in the command unit of work. */
    commit(): AggregateRootCommitResult {
        if (!this.#sourceId) throw new Error('The aggregate is not active');
        return new AggregateRootCommitResult(this, this.#pending.slice(this.#staged), {
            [this.#sourceId]: { eventSourceId: true, sequenceNumber: this.#tail, ...this.#route }
        }, this.#staged);
    }
    /** @internal */
    assertUnstaged(result: AggregateRootCommitResult): void {
        if (result.start !== this.#staged || result.events.length > this.#pending.length - this.#staged)
            throw new Error('Aggregate events were already staged or changed after commit()');
    }
    /** @internal */
    stage(count: number): void { this.#staged += count; }
    /** @internal */
    get hasUnstagedEvents(): boolean { return this.#staged < this.#pending.length; }
    #dispatch(type: EventClass, event: object, context?: EventContext): void {
        this.#handlers.get(type)?.(event, context);
    }
}
