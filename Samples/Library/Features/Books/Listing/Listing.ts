// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { ChronicleReadModels } from '@cratis/arc.chronicle';
import { argument, query, readModel, service } from '@cratis/arc.core';
import type { Observable } from 'rxjs';
import { fromEvent } from '@cratis/chronicle/projections';
import { BookAdded } from '../Registration/Registration.js';
import { AuthorId } from '../../Authors/AuthorId.js';
import { BookId } from '../BookId.js';
import { BookTitle } from '../BookTitle.js';
import { observeProjected } from '../../observeProjected.js';

@readModel()
@fromEvent(BookAdded)
export class Book {
    @field(BookId) id!: BookId;
    @field(AuthorId) authorId!: AuthorId;
    @field(BookTitle) title!: BookTitle;

    @query({ observable: true }, argument('authorId', AuthorId), service(ChronicleReadModels))
    static booksForAuthor(authorId: AuthorId, models: ChronicleReadModels): Observable<Book[]> {
        return observeProjected(models, Book, book => book.id.toString(),
            book => book.authorId.toString() === authorId.toString());
    }
}
