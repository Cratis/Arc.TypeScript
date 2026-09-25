// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { constraint, type IConstraint, type IConstraintBuilder } from '@cratis/chronicle/events';
import { command, key, roles } from '@cratis/arc.core';
import { AuthorId } from '../AuthorId.js';
import { AuthorName } from '../AuthorName.js';

@eventType()
export class AuthorRegistered {
    @field(AuthorName) name: AuthorName;
    constructor(name: AuthorName = new AuthorName('')) { this.name = name; }
}

@command()
@roles('Librarian')
export class RegisterAuthor {
    @key() @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    handle(): AuthorRegistered { return new AuthorRegistered(this.name); }
}

@constraint()
export class UniqueAuthorName implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(unique => unique.on(AuthorRegistered, event => event.name)
            .withMessage('Author name must be unique'));
    }
}
