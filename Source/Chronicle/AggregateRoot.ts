// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { EventSequenceNumber } from '@cratis/chronicle/eventSequences';
import type { ConcurrencyScope, EventForEventSourceId } from '@cratis/chronicle/eventSequences';

/** The aggregate's pending events, committed by the command's Chronicle scope. */
export class AggregateRootCommitResult {
    constructor(readonly events: readonly EventForEventSourceId[], readonly scopes: Readonly<Record<string, ConcurrencyScope>>) {}
}

/** Rehydrated state and pending events for one Chronicle event source. */
export class AggregateRoot {
    #sourceId?: string;
    #pending: EventForEventSourceId[] = [];
    #committed = false;
    #sequenceNumber = EventSequenceNumber.beforeFirst.value;
    /** True when no recorded events were found for the selected event source. */
    protected isNew = true;
    /** Called by the command argument resolver after loading the event log. */
    rehydrate(sourceId: string, events: readonly { name: string; content: object; sequenceNumber: bigint }[]): void {
        if (this.#sourceId) throw new Error('An aggregate can only be rehydrated once');
        this.#sourceId = sourceId;
        this.isNew = !events.length;
        for (const entry of events) {
            this.dispatch(entry.name, entry.content);
            this.#sequenceNumber = entry.sequenceNumber;
        }
    }
    /** Apply a registered event to in-memory state and stage it for commit. */
    apply(event: object): void {
        if (!this.#sourceId || this.#committed) throw new Error('The aggregate is not active');
        this.dispatch(event.constructor.name, event);
        this.#pending.push({ eventSourceId: this.#sourceId, event });
    }
    /** Return the pending batch; returning it from handle() enrolls it in the command transaction. */
    commit(): AggregateRootCommitResult {
        if (!this.#sourceId || this.#committed) throw new Error('The aggregate is not active');
        this.#committed = true;
        return new AggregateRootCommitResult([...this.#pending], {
            [this.#sourceId]: { eventSourceId: true, sequenceNumber: this.#sequenceNumber }
        });
    }
    private dispatch(name: string, event: object): void {
        const handler = Reflect.get(this, `on${name}`);
        if (typeof handler !== 'function') throw new Error(`No aggregate handler for ${name}`);
        handler.call(this, event);
    }
}
