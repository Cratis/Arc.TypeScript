// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Constructor } from '@cratis/fundamentals';
import type { IEventStore } from '@cratis/chronicle';
import type { EventRouting } from './eventRouting.js';
import type { EventSourceReference } from './EventSourceReference.js';
import { resolveEventSourceSelector } from './eventSourceDefinition.js';
import { declaredEventSource, supportsEventSources, unsupported } from './eventSourceSdk.js';

/** A reference resolved against a registered definition. */
export interface EventSourceRoute {
    /** The registered name, which is the event source type of appended events. */
    readonly name: string;
    /** The declared stream name, which is the event stream type of appended events. */
    readonly stream?: string;
}

function describe(selector: Constructor | string): string { return typeof selector === 'string' ? selector : selector.name; }

/** Reject the legacy string attributes that contradict, rather than repeat, the definition. */
function checkAgainstLegacy(owner: string, name: string, streams: readonly string[], stream: string | undefined, legacy: EventRouting): void {
    if (legacy.eventSourceType !== undefined && legacy.eventSourceType !== name)
        throw new Error(`${owner} declares event source type '${legacy.eventSourceType}', which contradicts its event source definition '${name}'`);
    if (stream !== undefined && legacy.eventStreamType !== undefined && legacy.eventStreamType !== stream)
        throw new Error(`${owner} declares event stream type '${legacy.eventStreamType}', which contradicts its stream '${stream}' of event source '${name}'`);
    if (stream === undefined && legacy.eventStreamType !== undefined && !streams.includes(legacy.eventStreamType))
        throw new Error(`${owner} declares event stream type '${legacy.eventStreamType}', which event source '${name}' does not declare (${streams.join(', ') || 'no streams'})`);
}

function checkStream(owner: string, name: string, streams: readonly string[], stream: string | undefined): void {
    if (stream !== undefined && !streams.includes(stream))
        throw new Error(`${owner} selects stream '${stream}', which event source '${name}' does not declare (${streams.join(', ') || 'no streams'})`);
}

/**
 * Validate a reference without a connection: the definition must be an `@eventSource` class (or, for a name, one of the
 * known definitions), the stream must belong to it, and legacy string attributes must not contradict it.
 * @param known - The definitions Arc registers with Chronicle; a name cannot be validated without them.
 */
export function validateEventSourceReference(owner: string, reference: EventSourceReference, legacy: EventRouting,
    known?: readonly Constructor[]): void {
    if (!supportsEventSources) throw new Error(unsupported(owner));
    const selector = resolveEventSourceSelector(reference.source);
    let definition = typeof selector === 'string' ? undefined : declaredEventSource(selector);
    if (typeof selector !== 'string' && !definition)
        throw new Error(`${owner} refers to ${selector.name}, which is not an event source definition; decorate it with @eventSource()`);
    if (typeof selector === 'string') {
        if (!known) return;
        const matches = known.map(declaredEventSource).filter(candidate => candidate?.name === selector);
        if (!matches.length)
            throw new Error(`${owner} refers to unknown event source definition '${selector}'; known definitions: ${
                known.map(type => declaredEventSource(type)?.name ?? type.name).join(', ') || 'none'}`);
        definition = matches[0];
    }
    checkStream(owner, definition!.name, definition!.streams, reference.stream);
    checkAgainstLegacy(owner, definition!.name, definition!.streams, reference.stream, legacy);
}

/** Resolve a reference through the store's registered definitions; fails clearly when the SDK predates them. */
export function resolveEventSourceRoute(store: IEventStore, owner: string, reference: EventSourceReference, legacy: EventRouting = {}): EventSourceRoute {
    const selector = resolveEventSourceSelector(reference.source);
    if (!store.eventSources) throw new Error(unsupported(owner));
    let definition;
    try { definition = store.eventSources.getFor(selector); }
    catch (error) { throw new Error(`${owner} refers to event source definition '${describe(selector)}' that is not registered with Chronicle`, { cause: error }); }
    const streams = definition.streams.map(stream => stream.name);
    checkStream(owner, definition.name, streams, reference.stream);
    checkAgainstLegacy(owner, definition.name, streams, reference.stream, legacy);
    return { name: definition.name, ...(reference.stream === undefined ? {} : { stream: reference.stream }) };
}

/** Fail clearly rather than append without routing when entries select a definition the store cannot honor. */
export function assertEventSourcesSupported(store: IEventStore, entries: readonly { readonly eventSource?: unknown; readonly eventStream?: string }[]): void {
    if (!store.eventSources && entries.some(entry => entry.eventSource !== undefined || entry.eventStream !== undefined))
        throw new Error(unsupported('An appended event'));
}
