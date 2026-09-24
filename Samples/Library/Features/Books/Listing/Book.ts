// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { argument, query, readModel, service, type ObservableSource } from '@cratis/arc.core';
import { AuthorId } from '../../Authors/AuthorId.js';
import { BookId } from '../BookId.js';
import { BookTitle } from '../BookTitle.js';
import { Books } from '../Books.js';

@readModel()
export class Book {
    @field(BookId) id!: BookId;
    @field(AuthorId) authorId!: AuthorId;
    @field(BookTitle) title!: BookTitle;

    @query({ observable: true }, argument('authorId', AuthorId), service(Books))
    static booksForAuthor(authorId: AuthorId, books: Books): Promise<ObservableSource<Book[]>> {
        return books.observeForAuthor(authorId);
    }
}
