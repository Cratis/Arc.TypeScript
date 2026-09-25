// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { commandArgument, currentServices } from '@cratis/arc.core';
import type { ServiceToken, CommandContext } from '@cratis/arc.core';
import { EventSequenceNumber } from '@cratis/chronicle/eventSequences';
import { getEventTypeMetadata } from '@cratis/chronicle/events';
import { AggregateRoot, rehydrateAggregate } from './AggregateRoot.js';
import { ChronicleRuntime } from './ChronicleRuntime.js';
import { ChronicleUnitOfWork } from './ChronicleUnitOfWork.js';
import { eventRoutingFor } from './eventRouting.js';

const loaded = new WeakMap<CommandContext, Map<object, Promise<AggregateRoot>>>();
/** Inject a rehydrated aggregate for the command key into handle() or provide(). */
export function commandAggregate<T extends AggregateRoot>(type: new () => T): ServiceToken<T> {
    if (!(type.prototype instanceof AggregateRoot)) throw new Error('A command aggregate must extend AggregateRoot');
    return commandArgument(`Chronicle aggregate ${type.name}`, context => {
        let byType = loaded.get(context);
        if (!byType) { byType = new Map(); loaded.set(context, byType); }
        if (!byType.has(type)) {
            byType.set(type, load(context));
        }
        return byType.get(type)! as Promise<T>;
    });
    async function load(context: CommandContext): Promise<T> {
        if (!context.key?.trim()) throw new Error(`A command key is required for ${type.name}`);
        const store = await (await currentServices().resolve(ChronicleRuntime)).getStore(context);
        const aggregate = new type();
        const route = eventRoutingFor((context.command as object).constructor);
        const command = context.command as { getEventStreamId?: () => string };
        const streamId = command.getEventStreamId?.() ?? route.eventStreamId;
        const source = route.eventSourceType;
        const streamType = route.eventStreamType;
        const tail = await store.eventLog.getTailSequenceNumber(context.key, source, streamType, streamId);
        const handlers = aggregate.eventTypes;
        const events = handlers.length ? await store.eventLog.getForEventSourceIdAndEventTypes(
            context.key, handlers, streamType, streamId, source) : [];
        aggregate[rehydrateAggregate](context.key,
            tail.value === EventSequenceNumber.unset.value ? EventSequenceNumber.beforeFirst.value : tail.value,
            { eventSourceType: source, eventStreamType: streamType, eventStreamId: streamId },
            events.map(entry => {
                const eventType = handlers.find(candidate => {
                    const metadata = getEventTypeMetadata(candidate);
                    return metadata?.eventType.id.value === entry.eventType.id.value &&
                        metadata.eventType.generation.value === entry.eventType.generation.value;
                });
                if (!eventType) throw new Error(`Unknown aggregate event type ${entry.eventType.toString()}`);
                return { type: eventType, content: entry.content, context: entry.context };
            }));
        ChronicleUnitOfWork.active()?.track(aggregate);
        return aggregate;
    }
}
