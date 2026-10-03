// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { commandArgument, currentServices } from '@cratis/arc.core';
import type { ServiceToken, CommandContext } from '@cratis/arc.core';
import { EventSequenceNumber } from '@cratis/chronicle/eventSequences';
import { getEventTypeMetadata } from '@cratis/chronicle/events';
import { AggregateRoot, rehydrateAggregate } from './AggregateRoot.js';
import { ChronicleScopedStore } from './ChronicleStores.js';
import { ChronicleUnitOfWork } from './ChronicleUnitOfWork.js';
import { eventRoutingFor } from './eventRouting.js';
import { eventSourceReferenceFor } from './eventSourceDefinition.js';
import type { Constructor } from '@cratis/fundamentals';
import type { IEventStore } from '@cratis/chronicle';
import type { EventSourceReference } from './EventSourceReference.js';
import { resolveEventSourceRoute } from './eventSourceRoute.js';

/** The aggregate's own definition, or the command's; both must agree when both are declared. */
function aggregateReference(store: IEventStore, aggregate: Constructor, command: Constructor): EventSourceReference | undefined {
    const own = eventSourceReferenceFor(aggregate);
    const inherited = eventSourceReferenceFor(command);
    if (!own || !inherited) return own ?? inherited;
    const label = `Aggregate ${aggregate.name} and command ${command.name}`;
    const left = resolveEventSourceRoute(store, label, { source: own.source });
    const right = resolveEventSourceRoute(store, label, { source: inherited.source });
    if (left.name !== right.name || (own.stream !== undefined && inherited.stream !== undefined && own.stream !== inherited.stream))
        throw new Error(`${label} select different event source definitions or streams`);
    return { source: own.source, stream: own.stream ?? inherited.stream };
}

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
        const store = await (await currentServices().resolve(ChronicleScopedStore)).getStore(context);
        const aggregate = new type();
        const route = eventRoutingFor((context.command as object).constructor);
        const command = context.command as { getEventStreamId?: () => string };
        const streamId = command.getEventStreamId?.() ?? route.eventStreamId;
        const commandType = (context.command as object).constructor as Constructor;
        const reference = aggregateReference(store, type as Constructor, commandType);
        let source = route.eventSourceType;
        let streamType = route.eventStreamType;
        if (reference) {
            // The aggregate is guarded, and rehydrated, only from the declared source and stream.
            const resolved = resolveEventSourceRoute(store, `Aggregate ${type.name}`, reference, route);
            source = resolved.name;
            streamType = resolved.stream ?? streamType;
        }
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
            }), reference);
        ChronicleUnitOfWork.active()?.track(aggregate);
        return aggregate;
    }
}
