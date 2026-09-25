// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ChronicleCommandScenario } from '@cratis/arc.chronicle/testing';
import { AuthorId } from '../../../../Authors/AuthorId.js';
import { BookId } from '../../../BookId.js';
import { BookTitle } from '../../../BookTitle.js';
import { BookTitleValidator } from '../../../BookTitle.js';
import { AddBook, AddBookValidator, BookAdded } from '../../Registration.js';

describe('when adding a book for an author', () => {
    const scenario = ChronicleCommandScenario.for(AddBook, BookAdded, AddBookValidator, BookTitleValidator);
    const authorId = AuthorId.create();
    const bookId = BookId.create();
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeAll(async () => {
        result = await scenario.execute({ bookId, authorId, title: new BookTitle('Parable of the Sower') });
    });
    afterAll(async () => { await scenario.dispose(); });
    it('should append the book with its author and title', () => {
        result.shouldBeSuccessful();
        result.shouldHaveAppendedEvent(BookAdded, bookId.toString(),
            event => event.authorId.toString() === authorId.toString() && event.title.value === 'Parable of the Sower');
    });
});
