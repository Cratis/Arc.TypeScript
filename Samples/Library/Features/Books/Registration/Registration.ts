// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, key, CommandValidator, validator } from '@cratis/arc.core';
import { AuthorId } from '../../Authors/AuthorId.js';
import { BookId } from '../BookId.js';
import { BookTitle } from '../BookTitle.js';
import { Books } from '../Books.js';

@eventType('LibraryBookAdded')
export class BookAdded {
    @field(AuthorId) authorId: AuthorId;
    @field(BookTitle) title: BookTitle;
    constructor(authorId: AuthorId, title: BookTitle) { this.authorId = authorId; this.title = title; }
}

@command()
export class AddBook {
    @key() @field(BookId) bookId!: BookId;
    @field(AuthorId) authorId!: AuthorId;
    @field(BookTitle) title!: BookTitle;

    async handle(books: Books): Promise<void> {
        await books.add(this.bookId, this.authorId, this.title, new BookAdded(this.authorId, this.title));
    }
}

@validator(AddBook)
export class AddBookValidator extends CommandValidator<AddBook> {
    constructor() {
        super();
        this.ruleFor(command => command.title).notEmpty().withMessage('A title is required');
    }
}
