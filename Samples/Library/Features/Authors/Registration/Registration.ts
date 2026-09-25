// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { reactor } from '@cratis/chronicle/reactors';
import { command, key, roles, CommandValidator, currentServices, validator, type CommandContext } from '@cratis/arc.core';
import { AuthorId } from '../AuthorId.js';
import { AuthorName } from '../AuthorName.js';
import { Authors } from '../Authors.js';

@eventType('LibraryAuthorRegistered')
export class AuthorRegistered {
    @field(AuthorName) name: AuthorName;
    constructor(name: AuthorName) { this.name = name; }
}

@eventType('LibraryAuthorWelcomed')
export class AuthorWelcomed {
    @field(AuthorName) name: AuthorName;
    constructor(name: AuthorName) { this.name = name; }
}

@reactor('LibraryAuthorWelcomeReactor')
export class AuthorWelcomeReactor {
    authorRegistered(event: AuthorRegistered): AuthorWelcomed { return new AuthorWelcomed(event.name); }
}

@command()
@roles('Librarian')
export class RegisterAuthor {
    @key() @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    async handle(authors: Authors, context: CommandContext): Promise<AuthorId> {
        if (context.key !== this.id.toString()) throw new Error('Author command key does not match its id');
        await authors.register(this.id, this.name, new AuthorRegistered(this.name));
        return this.id;
    }
}

@validator(RegisterAuthor)
export class RegisterAuthorValidator extends CommandValidator<RegisterAuthor> {
    constructor() {
        super();
        this.ruleFor(command => command.name)
            .mustAsync(async (_name, command) => !await (await currentServices().resolve(Authors)).existsByName(command.name))
            .withMessage('An author with that name is already registered');
    }
}
