// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Command-wide routing defaults; a returned EventForEventSourceId can override each value. */
export interface EventRouting {
    readonly eventSourceType?: string;
    readonly eventStreamType?: string;
    readonly eventStreamId?: string;
    readonly subject?: string;
    readonly concurrentSource?: boolean;
    readonly concurrentStreamType?: boolean;
    readonly concurrentStreamId?: boolean;
}
const routing = new WeakMap<object, EventRouting>();
function route(part: Partial<EventRouting>): (target: object, context?: ClassDecoratorContext) => void {
    return target => { routing.set(target, { ...routing.get(target), ...part }); };
}
/** Set the command's default event source type and optionally include it in optimistic checks. */
export function eventSourceType(value: string, options: { concurrency?: boolean } = {}): ReturnType<typeof route> {
    return route({ eventSourceType: value, concurrentSource: options.concurrency });
}
/** Set the default stream type and optionally include it in optimistic checks. */
export function eventStreamType(value: string, options: { concurrency?: boolean } = {}): ReturnType<typeof route> {
    return route({ eventStreamType: value, concurrentStreamType: options.concurrency });
}
/** Set the default stream id and optionally include it in optimistic checks. */
export function eventStreamId(value: string, options: { concurrency?: boolean } = {}): ReturnType<typeof route> {
    return route({ eventStreamId: value, concurrentStreamId: options.concurrency });
}
/** Set the default compliance subject for events returned by this command. */
export function eventSubject(value: string): ReturnType<typeof route> { return route({ subject: value }); }
/** Read command routing after decorators in either TypeScript decorator mode. */
export function eventRoutingFor(type: object): EventRouting { return routing.get(type) ?? {}; }
