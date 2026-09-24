// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, key } from '@cratis/arc.core';
import { AuthorId } from '../../Authors/AuthorId.js';
import { BookId } from '../BookId.js';
import { BookTitle } from '../BookTitle.js';
import { Books } from '../Books.js';

@command()
export class AddBook {
    @key() @field(BookId) bookId!: BookId;
    @field(AuthorId) authorId!: AuthorId;
    @field(BookTitle) title!: BookTitle;

    async handle(books: Books): Promise<void> {
        await books.add(this.bookId, this.authorId, this.title);
    }
}
