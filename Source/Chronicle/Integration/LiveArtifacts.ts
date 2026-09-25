// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { onceOnly, reactor } from '@cratis/chronicle/reactors';
import type { EventContext } from '@cratis/chronicle/events';
import { fromEvent } from '@cratis/chronicle/projections';
import { command, key, readModel, query, argument, service, inject, commandReadModel, commandContext, CommandOperation, tuple } from '@cratis/arc.core';
import type { CommandContext } from '@cratis/arc.core';
import { ChronicleRuntime } from '../ChronicleRuntime.js';
import { ChronicleReadModels } from '../ChronicleReadModels.js';
import { eventsWithConcurrencyScopes } from '../EventsWithConcurrencyScopes.js';
import { AggregateRoot } from '../AggregateRoot.js';
import { commandAggregate } from '../commandAggregate.js';
import { EventSequenceNumber } from '@cratis/chronicle/eventSequences';

@eventType('ArcTypeScriptLiveCreated')
export class LiveCreated { @field(String) name: string; constructor(name: string) { this.name = name; } }

@eventType('ArcTypeScriptLiveFollowedUp')
export class LiveFollowedUp { @field(String) name: string; constructor(name: string) { this.name = name; } }

@command()
export class FollowUpLive {
    @field(String) @key() id = '';
    @field(String) name = '';
    constructor(id = '', name = '') { this.id = id; this.name = name; }
    handle(): LiveFollowedUp { return new LiveFollowedUp(this.name); }
}

@onceOnly()
@reactor('ArcTypeScriptLiveCommandReactor')
export class LiveCommandReactor {
    liveCreated(event: LiveCreated, context: EventContext): FollowUpLive {
        return new FollowUpLive(context.eventSourceId, event.name);
    }
}

@command()
export class CreateLive {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle(): LiveCreated { return new LiveCreated(this.name); }
}

@command()
export class CreateLiveExactlyOnce {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle() {
        return eventsWithConcurrencyScopes([new LiveCreated(this.name)], {
            [this.id]: { eventSourceId: true, sequenceNumber: EventSequenceNumber.beforeFirst.value }
        });
    }
}

export class LiveAggregate extends AggregateRoot {
    count = 0;
    constructor() { super(); this.on(LiveCreated, () => { this.count++; }); }
}

@command()
export class AdvanceLive {
    @field(String) @key() id = '';
    @field(String) name = '';
    @inject(commandAggregate(LiveAggregate))
    handle(aggregate: LiveAggregate) {
        if (aggregate.count !== 1) throw new Error('Live aggregate was not rehydrated');
        aggregate.apply(new LiveCreated(this.name));
        return aggregate.commit();
    }
}

@command()
export class AdvanceLiveWithConcurrentAppend {
    @field(String) @key() id = '';
    @field(String) name = '';
    @inject(commandAggregate(LiveAggregate), commandContext(), ChronicleRuntime)
    async handle(aggregate: LiveAggregate, context: CommandContext, runtime: ChronicleRuntime) {
        if (aggregate.count !== 1) throw new Error('Live aggregate was not rehydrated');
        const store = await runtime.getStore(context);
        const competing = await store.eventLog.append(this.id, new LiveCreated('competitor'));
        if (!competing.isSuccess) throw new Error('Competing append failed');
        aggregate.apply(new LiveCreated(this.name));
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
        return tuple(eventsWithConcurrencyScopes([new LiveCreated(this.name)], {
            [this.id]: { eventSourceId: true, sequenceNumber: EventSequenceNumber.beforeFirst.value }
        }), new LiveOperation());
    }
}

@readModel()
@fromEvent(LiveCreated)
export class LiveView {
    static readonly readModelId = 'ArcTypeScriptLiveView';
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
    handle(): LiveCreated[] { return [new LiveCreated(this.name), new LiveCreated(this.name)]; }
}
