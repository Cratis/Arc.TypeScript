// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Constructor } from '@cratis/fundamentals';
import type { EventSourceReference } from './EventSourceReference.js';
import type { EventSourceSelector } from './EventSourceSelector.js';

const references = new WeakMap<object, EventSourceReference>();

/**
 * Select the Chronicle event source definition (and optionally one of its streams) that a command or an aggregate
 * root appends through. The reference is validated at startup and resolved by Chronicle when appending, so each
 * event records its event source. Source and stream belong to routing; they are never declared on event types.
 * Supports legacy and standard class decorators.
 * @param source - The `@eventSource` class, its name, or a thunk returning the class for circular imports.
 * @param stream - A stream declared by the definition.
 */
export function eventSourceDefinition(source: EventSourceSelector, stream?: string):
    (target: object, context?: ClassDecoratorContext) => void {
    return target => { references.set(target, { source, ...(stream === undefined ? {} : { stream }) }); };
}

/** The event source definition a command or aggregate class declared, if any. */
export function eventSourceReferenceFor(type: object): EventSourceReference | undefined { return references.get(type); }

/** Resolve a thunk to its class; a class or a name is returned unchanged. */
export function resolveEventSourceSelector(source: EventSourceSelector): Constructor | string {
    // Classes have a prototype; arrow-function thunks do not.
    return typeof source === 'function' && source.prototype === undefined ? (source as () => Constructor)() : source as Constructor | string;
}
