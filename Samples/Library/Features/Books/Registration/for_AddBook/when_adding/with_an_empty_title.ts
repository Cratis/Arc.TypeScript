// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario } from '@cratis/arc.testing';
import { AuthorId } from '../../../../Authors/AuthorId.js';
import { BookId } from '../../../BookId.js';
import { BookTitle } from '../../../BookTitle.js';
import { BookTitleValidator } from '../../../BookTitleValidator.js';
import { Books } from '../../../Books.js';
import { AddBook } from '../../AddBook.js';
import { AddBookValidator } from '../../AddBookValidator.js';
import { metadata } from '../../../../generatedMetadata.js';

describe('when adding a book with an empty title', () => {
    const books = new Books();
    const scenario = CommandScenario.for(AddBook, AddBookValidator, BookTitleValidator);
    scenario.extend(builder => builder.useGeneratedMetadata(metadata));
    scenario.services.addSingleton(Books, books);
    const authorId = AuthorId.create();
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeAll(async () => {
        result = await scenario.execute({ bookId: BookId.create(), authorId, title: new BookTitle('') });
    });
    afterAll(async () => { await scenario.dispose(); });
    it('should reject the title without adding a book', async () => {
        result.isValid.should.equal(false);
        (await books.forAuthor(authorId)).should.have.lengthOf(0);
    });
});
