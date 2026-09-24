// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { EventForEventSourceId } from '@cratis/chronicle/eventSequences';

const marker = Symbol('Arc.Chronicle.EventForEventSourceId');
export type RoutedEvent = EventForEventSourceId & { readonly [marker]: true };
/** Mark an explicitly routed event; an ordinary DTO with similar fields is not an event. */
export function eventForEventSourceId(entry: EventForEventSourceId): RoutedEvent {
    return Object.assign({ ...entry }, { [marker]: true as const });
}
export function isRoutedEvent(value: unknown): value is RoutedEvent {
    return typeof value === 'object' && value !== null && (value as RoutedEvent)[marker] === true;
}
