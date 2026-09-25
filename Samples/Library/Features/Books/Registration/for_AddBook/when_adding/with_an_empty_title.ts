// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ChronicleCommandScenario } from '@cratis/arc.chronicle/testing';
import { AuthorId } from '../../../../Authors/AuthorId.js';
import { BookId } from '../../../BookId.js';
import { BookTitle, BookTitleValidator } from '../../../BookTitle.js';
import { AddBook, AddBookValidator, BookAdded } from '../../Registration.js';

describe('when adding a book with an empty title', () => {
    const scenario = ChronicleCommandScenario.for(AddBook, BookAdded, AddBookValidator, BookTitleValidator);
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeAll(async () => {
        result = await scenario.execute({ bookId: BookId.create(), authorId: AuthorId.create(), title: new BookTitle('') });
    });
    afterAll(async () => { await scenario.dispose(); });
    it('should reject the title without appending a book', () => {
        result.isValid.should.equal(false);
        result.appendedEvents.should.have.lengthOf(0);
    });
});
