// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario, ObservableQueryScenario } from '@cratis/arc.testing';
import { AuthorId } from '../../../../Authors/AuthorId.js';
import { BookId } from '../../../BookId.js';
import { BookTitle } from '../../../BookTitle.js';
import { BookTitleValidator } from '../../../BookTitleValidator.js';
import { Books } from '../../../Books.js';
import { Book } from '../../../Listing/Book.js';
import { AddBook } from '../../AddBook.js';
import { AddBookValidator } from '../../AddBookValidator.js';
import { metadata } from '../../../../generatedMetadata.js';

describe('when adding a book for an author', () => {
    const books = new Books();
    const command = CommandScenario.for(AddBook, AddBookValidator, BookTitleValidator);
    const query = ObservableQueryScenario.for<{ id: string; title: string }[]>(Book, 'booksForAuthor');
    command.extend(builder => builder.useGeneratedMetadata(metadata));
    query.extend(builder => builder.useGeneratedMetadata(metadata));
    command.services.addSingleton(Books, books);
    query.services.addSingleton(Books, books);
    const authorId = AuthorId.create();
    let result: Awaited<ReturnType<typeof command.execute>>;
    let listing: Awaited<ReturnType<typeof query.collect>>;
    beforeAll(async () => {
        result = await command.execute({ bookId: BookId.create(), authorId, title: new BookTitle('Parable of the Sower') });
        listing = await query.collect(1, 5000, { authorId: authorId.toString() });
    });
    afterAll(async () => { await command.dispose(); await query.dispose(); });
    it('should return the book for its author', () => {
        result.shouldBeSuccessful();
        listing.emissions[0]?.isSuccess.should.equal(true);
        listing.emissions[0]?.data?.[0]?.title.should.equal('Parable of the Sower');
    });
});
