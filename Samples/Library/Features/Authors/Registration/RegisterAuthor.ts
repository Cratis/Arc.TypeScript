// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, key, roles, type CommandContext } from '@cratis/arc.core';
import { AuthorId } from '../AuthorId.js';
import { AuthorName } from '../AuthorName.js';
import { Authors } from '../Authors.js';

@command()
@roles('Librarian')
export class RegisterAuthor {
    @key() @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    async handle(authors: Authors, context: CommandContext): Promise<AuthorId> {
        if (context.key !== this.id.toString()) throw new Error('Author command key does not match its id');
        await authors.register(this.id, this.name);
        return this.id;
    }
}
