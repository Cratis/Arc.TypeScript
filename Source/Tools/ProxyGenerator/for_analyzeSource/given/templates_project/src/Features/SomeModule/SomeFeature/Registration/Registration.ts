// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, key } from '@cratis/arc.core';
import { eventType } from '@cratis/chronicle/events';
import { reactor } from '@cratis/chronicle/reactors';
import { field } from '@cratis/fundamentals';
import { SomeId } from '../SomeId.js';
import { SomeName } from '../SomeName.js';

@command()
export class Register {
    @key() @field(SomeId) id!: SomeId;
    @field(SomeName) name!: SomeName;

    handle(): Registered { return new Registered(this.name); }
}

@eventType()
export class Registered {
    @field(SomeName) name: SomeName;
    constructor(name: SomeName = new SomeName('')) { this.name = name; }
}

@reactor('TemplateRegistration')
export class RegistrationReactor {
    registered(event: Registered): void { console.log(`Registered ${event.name}`); }
}
