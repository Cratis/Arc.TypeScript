// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { randomUUID } from 'node:crypto';
import { isRegisteredEvent, hasEventType } from '@cratis/chronicle/events';
import { getSubjectPropertyName } from '@cratis/chronicle/compliance';
import type { AppendOptions, ConcurrencyScope, EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import type { CommandContext, CommandResponseValueHandler } from '@cratis/arc.core';
import { acknowledgeCommandCommit } from '@cratis/arc.core/hosting';
import { checkResults } from './ChronicleCommand.js';
import { ChronicleRuntime } from './ChronicleRuntime.js';
import { EventsWithConcurrencyScopes } from './EventsWithConcurrencyScopes.js';
import { eventRoutingFor } from './eventRouting.js';
import { ChronicleUnitOfWork } from './ChronicleUnitOfWork.js';
import { EventSourceIdResponse } from './eventSourceIdResponse.js';
import { eventForEventSourceId, isRoutedEvent } from './eventForEventSourceId.js';
import { AggregateRootCommitResult } from './AggregateRootCommitResult.js';
import { waitForProjectionCompletion } from './waitForProjectionCompletion.js';
import { chronicleIdentity } from './chronicleIdentity.js';
function eventLike(value: unknown): boolean {
    return typeof value === 'object' && value !== null && (isRoutedEvent(value) || hasEventType(value.constructor));
}
/** Consume only registered Chronicle events, leaving ordinary DTOs in the Arc response pipeline. */
export class ChronicleResponseHandler implements CommandResponseValueHandler {
    constructor(private readonly runtime: ChronicleRuntime) {}
    canHandle(_context: CommandContext, value: unknown): boolean {
        if (value instanceof AggregateRootCommitResult || value instanceof EventsWithConcurrencyScopes) return true;
        if (Array.isArray(value)) return value.length === 0 || value.some(eventLike);
        return eventLike(value);
    }
    async handle(context: CommandContext, value: unknown) {
        if (value instanceof AggregateRootCommitResult) value.aggregate.assertUnstaged(value);
        const exact = value instanceof EventsWithConcurrencyScopes ? value : undefined;
        const values = value instanceof AggregateRootCommitResult ? value.events.map(eventForEventSourceId) :
            exact ? [...exact.events] : Array.isArray(value) ? [...value] : [value];
        if (!values.length) return;
        const store = await this.runtime.getStore(context);
        if (!values.every(item => isRegisteredEvent(store, isRoutedEvent(item) ? item.event : item)))
            throw new Error('Every appended event must be registered in the selected Chronicle event store');
        const responseId = context.response instanceof EventSourceIdResponse ? context.response.value : undefined;
        if (responseId !== undefined) context.response = responseId;
        const sourceId = responseId ?? context.key ?? randomUUID();
        if (!sourceId.trim()) throw new Error('A Chronicle event source id must not be empty');
        const route = eventRoutingFor((context.command as object).constructor);
        const command = context.command as { getEventSourceId?: () => unknown; getEventStreamId?: () => string; getSubject?: () => unknown };
        const selectedId = sourceId;
        if (!selectedId?.trim()) throw new Error('The command provided an invalid event source id');
        const streamId = command.getEventStreamId?.() ?? route.eventStreamId;
        const subjectField = getSubjectPropertyName((context.command as object).constructor);
        const subject = chronicleIdentity(command.getSubject?.(), 'subject') ??
            (subjectField ? chronicleIdentity(Reflect.get(context.command as object, subjectField), 'subject') : undefined) ?? route.subject;
        const entries: EventForEventSourceId[] = values.map(item => {
            const original: EventForEventSourceId = isRoutedEvent(item) ? item : { eventSourceId: selectedId, event: item as object };
            if (typeof original.eventSourceId !== 'string' || !original.eventSourceId.trim())
                throw new Error('Every appended event must have a nonempty event source id');
            return { eventSourceId: original.eventSourceId, event: original.event,
                eventSourceType: original.eventSourceType ?? route.eventSourceType,
                eventStreamType: original.eventStreamType ?? route.eventStreamType,
                eventStreamId: original.eventStreamId ?? streamId,
                subject: original.subject ?? subject ?? original.eventSourceId,
                tags: original.tags, occurred: original.occurred };
        });
        const scopes: Record<string, ConcurrencyScope> = { ...exact?.scopes,
            ...(value instanceof AggregateRootCommitResult ? value.scopes : {}) };
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
        const unit = ChronicleUnitOfWork.active();
        if (unit) {
            unit.stage(store, context, entries, options);
            if (value instanceof AggregateRootCommitResult) value.aggregate.stage(entries.length);
            return;
        }
        const results = await store.eventLog.appendMany(entries, options);
        const outcome = checkResults(results, entries.length);
        if (!outcome) {
            acknowledgeCommandCommit(context);
            if (value instanceof AggregateRootCommitResult) value.aggregate.stage(entries.length);
            await waitForProjectionCompletion(results, this.runtime.options.completionTimeoutMs, context.signal);
        }
        return outcome;
    }
}
