// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { readModel as chronicleReadModel } from '@cratis/chronicle/readModels';
import { fromEvent } from '@cratis/chronicle/projections';
import { command, key, readModel, query, argument, service, inject, commandReadModel, CommandOperation, tuple } from '@cratis/arc.core';
import { ChronicleReadModels } from '../ChronicleReadModels.js';
import { eventsWithConcurrencyScopes } from '../EventsWithConcurrencyScopes.js';
import { AggregateRoot } from '../AggregateRoot.js';
import { commandAggregate } from '../commandAggregate.js';
import { EventSequenceNumber } from '@cratis/chronicle/eventSequences';

@eventType('ArcTypeScriptLiveCreated')
export class LiveCreated { @field(String) name = ''; }

@command()
export class CreateLive {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle(): LiveCreated { return Object.assign(new LiveCreated(), { name: this.name }); }
}

@command()
export class CreateLiveExactlyOnce {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle() {
        return eventsWithConcurrencyScopes([Object.assign(new LiveCreated(), { name: this.name })], {
            [this.id]: { eventSourceId: true, sequenceNumber: EventSequenceNumber.beforeFirst.value }
        });
    }
}

export class LiveAggregate extends AggregateRoot {
    count = 0;
    onLiveCreated(event: LiveCreated): void { void event; this.count++; }
}

@command()
export class AdvanceLive {
    @field(String) @key() id = '';
    @field(String) name = '';
    @inject(commandAggregate(LiveAggregate))
    handle(aggregate: LiveAggregate) {
        if (aggregate.count !== 1) throw new Error('Live aggregate was not rehydrated');
        aggregate.apply(Object.assign(new LiveCreated(), { name: this.name }));
        return aggregate.commit();
    }
}

export let liveOperationExecuted = false;
export let liveOperationCompensated = false;
class LiveOperation extends CommandOperation {
    execute(signal: AbortSignal) { signal.throwIfAborted(); liveOperationExecuted = true; }
    compensate(failure: unknown, signal: AbortSignal) { void failure; signal.throwIfAborted(); liveOperationCompensated = true; }
}
@command()
export class CreateLiveWithOperation {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle() {
        liveOperationExecuted = false;
        liveOperationCompensated = false;
        return tuple(eventsWithConcurrencyScopes([Object.assign(new LiveCreated(), { name: this.name })], {
            [this.id]: { eventSourceId: true, sequenceNumber: EventSequenceNumber.beforeFirst.value }
        }), new LiveOperation());
    }
}

@readModel()
@chronicleReadModel('ArcTypeScriptLiveView')
@fromEvent(LiveCreated)
export class LiveView {
    @field(String) id = '';
    @field(String) name = '';
    @query(argument('id', String), service(ChronicleReadModels))
    static async byId(id: string, models: ChronicleReadModels): Promise<LiveView | null> {
        return models.findInstanceById(LiveView, id);
    }
}

@command()
export class ReadLiveInCommand {
    @field(String) @key() id = '';
    @inject(commandReadModel(LiveView))
    handle(view: LiveView): string { return view.name; }
}

@command()
export class CreateLiveBatch {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle(): LiveCreated[] { return [Object.assign(new LiveCreated(), { name: this.name }),
        Object.assign(new LiveCreated(), { name: this.name })]; }
}
