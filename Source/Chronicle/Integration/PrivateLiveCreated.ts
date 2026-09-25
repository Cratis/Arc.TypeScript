// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { pii } from '@cratis/chronicle/compliance';
import { eventType } from '@cratis/chronicle/events';

/** Kernel fixture with an encrypted event value. */
@eventType('ArcTypeScriptPrivateLiveCreated')
export class PrivateLiveCreated {
    @field(String) @pii() name: string;
    constructor(name: string) { this.name = name; }
}
