// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import type { EventRouting } from './eventRouting.js';
import type { EventSourceReference } from './EventSourceReference.js';
import { resolveEventSourceSelector } from './eventSourceDefinition.js';

/** What an event inherits from its command: legacy string routing, an optional definition, and the stream id. */
export interface CommandEventRouting {
    readonly legacy: EventRouting;
    readonly reference?: EventSourceReference;
    readonly streamId?: string;
}

/** The routing fields of one appended event. */
export type EntryRouting = Pick<EventForEventSourceId, 'eventSourceType' | 'eventStreamType' | 'eventStreamId' | 'eventSource' | 'eventStream'>;

function defined<T extends object>(fields: { [K in keyof T]: T[K] | undefined }): T {
    return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as T;
}

/**
 * Route one event. The event's source and stream are one unit: an event that carries its own definition or its own raw
 * source/stream type replaces everything the command would otherwise supply for them, so a command's definition is never
 * silently combined with, or rewritten onto, an explicit per-event override. The stream id stays a separate default.
 */
export function routeEntry(original: EventForEventSourceId, command: CommandEventRouting): EntryRouting {
    const eventStreamId = original.eventStreamId ?? command.streamId;
    const ownDefinition = original.eventSource !== undefined || original.eventStream !== undefined;
    const ownRaw = original.eventSourceType !== undefined || original.eventStreamType !== undefined;
    if (ownDefinition) {
        return defined({ eventSource: original.eventSource ?? (command.reference ? resolveEventSourceSelector(command.reference.source) : undefined),
            eventStream: original.eventStream, eventSourceType: original.eventSourceType,
            eventStreamType: original.eventStreamType, eventStreamId });
    }
    if (ownRaw) {
        const inherited = command.reference ? {} : command.legacy;
        return defined({ eventSourceType: original.eventSourceType ?? inherited.eventSourceType,
            eventStreamType: original.eventStreamType ?? inherited.eventStreamType, eventStreamId });
    }
    if (command.reference) {
        return defined({ eventSource: resolveEventSourceSelector(command.reference.source), eventStream: command.reference.stream,
            // Legacy stream type without a declared stream names the stream; Chronicle validates it against the definition.
            eventStreamType: command.reference.stream === undefined ? command.legacy.eventStreamType : undefined, eventStreamId });
    }
    return defined({ eventSourceType: command.legacy.eventSourceType, eventStreamType: command.legacy.eventStreamType, eventStreamId });
}
