// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { commandArgument, currentServices } from '@cratis/arc.core';
import type { ServiceToken } from '@cratis/arc.core';
import { getEventTypeMetadata } from '@cratis/chronicle/events';
import type { CommandContext } from '@cratis/arc.core';
import { AggregateRoot } from './AggregateRoot.js';
import { ChronicleRuntime } from './ChronicleRuntime.js';

const loaded = new WeakMap<CommandContext, Map<object, Promise<AggregateRoot>>>();
/** Inject a rehydrated aggregate for the command key into handle() or provide(). */
export function commandAggregate<T extends AggregateRoot>(type: new () => T): ServiceToken<T> {
    if (!(type.prototype instanceof AggregateRoot)) throw new Error('A command aggregate must extend AggregateRoot');
    return commandArgument(`Chronicle aggregate ${type.name}`, context => {
        let byType = loaded.get(context);
        if (!byType) { byType = new Map(); loaded.set(context, byType); }
        if (!byType.has(type)) byType.set(type, load(context));
        return byType.get(type)! as Promise<T>;
    });
    async function load(context: CommandContext): Promise<T> {
        if (!context.key?.trim()) throw new Error(`A command key is required for ${type.name}`);
        const store = await (await currentServices().resolve(ChronicleRuntime)).getStore(context);
        const handlers = store.eventTypes.all.filter(eventType => typeof Reflect.get(type.prototype, `on${eventType.name}`) === 'function');
        const events = await store.eventLog.getForEventSourceIdAndEventTypes(context.key, handlers);
        const aggregate = new type();
        aggregate.rehydrate(context.key, events.map(entry => {
            const eventType = handlers.find(candidate => {
                const metadata = getEventTypeMetadata(candidate);
                return metadata?.eventType.id.value === entry.eventType.id.value &&
                    metadata.eventType.generation.value === entry.eventType.generation.value;
            });
            if (!eventType) throw new Error(`Unknown aggregate event type ${entry.eventType.toString()}`);
            return { name: eventType.name, content: entry.content, sequenceNumber: entry.context.sequenceNumber };
        }));
        return aggregate;
    }
}
