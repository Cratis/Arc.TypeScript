// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { EventSourceSelector } from './EventSourceSelector.js';

/** A command's or aggregate's reference to a Chronicle event source definition and, optionally, one of its streams. */
export interface EventSourceReference {
    /** The event source definition. */
    readonly source: EventSourceSelector;
    /** The name of a stream declared by the definition; it becomes the event stream type of appended events. */
    readonly stream?: string;
}
