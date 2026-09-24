// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { randomUUID } from 'node:crypto';
import { ConceptAs } from '@cratis/fundamentals';
import { isRegisteredEvent, hasEventType } from '@cratis/chronicle/events';
import { getSubjectPropertyName } from '@cratis/chronicle/compliance';
import type { AppendOptions, ConcurrencyScope, EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import type { CommandContext, CommandResponseValueHandler } from '@cratis/arc.core';
import { checkResults } from './ChronicleCommand.js';
import { ChronicleRuntime } from './ChronicleRuntime.js';
import { EventsWithConcurrencyScopes } from './EventsWithConcurrencyScopes.js';
import { eventRoutingFor } from './eventRouting.js';

function wrapped(value: unknown): value is EventForEventSourceId {
    return typeof value === 'object' && value !== null && 'event' in value && 'eventSourceId' in value;
}
function eventLike(value: unknown): boolean {
    return typeof value === 'object' && value !== null && (wrapped(value) || hasEventType(value.constructor));
}
function identifier(value: unknown): string | undefined {
    if (typeof value === 'string') return value || undefined;
    if (value instanceof ConceptAs && typeof value.value === 'string') return value.value || undefined;
    return undefined;
}
/** Consume only registered Chronicle events, leaving ordinary DTOs in the Arc response pipeline. */
export class ChronicleResponseHandler implements CommandResponseValueHandler {
    constructor(private readonly runtime: ChronicleRuntime) {}
    canHandle(_context: CommandContext, value: unknown): boolean {
        if (value instanceof EventsWithConcurrencyScopes) return true;
        if (Array.isArray(value)) return value.some(eventLike);
        return eventLike(value);
    }
    async handle(context: CommandContext, value: unknown) {
        const store = await this.runtime.getStore(context);
        const exact = value instanceof EventsWithConcurrencyScopes ? value : undefined;
        const values = exact ? [...exact.events] : Array.isArray(value) ? [...value] : [value];
        if (!values.length) throw new Error('Chronicle cannot append an empty event batch');
        if (!values.every(item => isRegisteredEvent(store, wrapped(item) ? item.event : item)))
            throw new Error('Every appended event must be registered in the selected Chronicle event store');
        const responseId = identifier(context.response);
        const sourceId = responseId ?? context.key ?? randomUUID();
        if (!sourceId.trim()) throw new Error('A Chronicle event source id must not be empty');
        const route = eventRoutingFor((context.command as object).constructor);
        const command = context.command as { getEventSourceId?: () => unknown; getEventStreamId?: () => string; getSubject?: () => string };
        const supplied = command.getEventSourceId?.();
        const selectedId = responseId ?? (supplied === undefined ? sourceId : identifier(supplied));
        if (!selectedId?.trim()) throw new Error('The command provided an invalid event source id');
        const streamId = command.getEventStreamId?.() ?? route.eventStreamId;
        const subjectField = getSubjectPropertyName((context.command as object).constructor);
        const subject = command.getSubject?.() ?? (subjectField ? identifier(Reflect.get(context.command as object, subjectField)) : undefined) ?? route.subject;
        const entries: EventForEventSourceId[] = values.map(item => {
            const original = wrapped(item) ? item : { eventSourceId: selectedId, event: item as object };
            if (typeof original.eventSourceId !== 'string' || !original.eventSourceId.trim())
                throw new Error('Every appended event must have a nonempty event source id');
            return { eventSourceId: original.eventSourceId, event: original.event,
                eventSourceType: original.eventSourceType ?? route.eventSourceType,
                eventStreamType: original.eventStreamType ?? route.eventStreamType,
                eventStreamId: original.eventStreamId ?? streamId,
                subject: original.subject ?? subject ?? original.eventSourceId,
                tags: original.tags, occurred: original.occurred };
        });
        const scopes: Record<string, ConcurrencyScope> = { ...exact?.scopes };
        if (route.concurrentSource || route.concurrentStreamType || route.concurrentStreamId) {
            await Promise.all([...new Set(entries.map(entry => entry.eventSourceId))].map(async id => {
                if (scopes[id]) return;
                const sample = entries.find(entry => entry.eventSourceId === id)!;
                const source = route.concurrentSource ? sample.eventSourceType : undefined;
                const type = route.concurrentStreamType ? sample.eventStreamType : undefined;
                const stream = route.concurrentStreamId ? sample.eventStreamId : undefined;
                scopes[id] = { sequenceNumber: (await store.eventLog.getTailSequenceNumber(id, source, type, stream)).value,
                    eventSourceId: true, eventSourceType: source, eventStreamType: type, eventStreamId: stream };
            }));
        }
        context.signal.throwIfAborted();
        const options: AppendOptions = { correlationId: context.correlationId,
            ...(Object.keys(scopes).length ? { concurrencyScopes: scopes } : {}) };
        const results = await store.eventLog.appendMany(entries, options);
        return checkResults(results, entries.length);
    }
}
