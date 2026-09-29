// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, key } from '@cratis/arc.core';
import { eventType } from '@cratis/chronicle/events';
import type { EventContext } from '@cratis/chronicle/events';
import { reactor } from '@cratis/chronicle/reactors';

@eventType('ArcTypeScriptScopedLiveCreated')
export class ScopedLiveCreated { @field(String) name: string; constructor(name: string) { this.name = name; } }

@eventType('ArcTypeScriptScopedLiveFollowedUp')
export class ScopedLiveFollowedUp { @field(String) name: string; constructor(name: string) { this.name = name; } }

/** A scoped service the reactor receives through its constructor. */
export class ScopedLiveGreeting { readonly prefix = 'greeted'; }

@command()
export class CreateScopedLive {
    @field(String) @key() id = '';
    @field(String) name = '';
    constructor(id = '', name = '') { this.id = id; this.name = name; }
    handle(): ScopedLiveCreated { return new ScopedLiveCreated(this.name); }
}

@command()
export class FollowUpScopedLive {
    @field(String) @key() id = '';
    @field(String) name = '';
    constructor(id = '', name = '') { this.id = id; this.name = name; }
    handle(): ScopedLiveFollowedUp { return new ScopedLiveFollowedUp(this.name); }
}

/** Constructed by Arc in a scope per delivery; its returned command appends through the delivered store. */
@reactor('ArcTypeScriptScopedLiveReactor')
export class ScopedLiveReactor {
    static readonly inject = [ScopedLiveGreeting];
    constructor(readonly greeting: ScopedLiveGreeting) {}
    scopedLiveCreated(event: ScopedLiveCreated, context: EventContext): FollowUpScopedLive {
        return new FollowUpScopedLive(context.eventSourceId, `${this.greeting.prefix}-${event.name}`);
    }
}
