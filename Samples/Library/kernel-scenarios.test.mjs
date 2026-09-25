// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import { setInterval, clearInterval } from 'node:timers';
import assert from 'node:assert/strict';
import { ChronicleKernelScenario } from '@cratis/arc.chronicle/testing';
import { AuthorId } from './dist/Features/Authors/AuthorId.js';
import { AuthorName, AuthorNameValidator } from './dist/Features/Authors/AuthorName.js';
import { AuthorRegistered, RegisterAuthor, UniqueAuthorName } from './dist/Features/Authors/Registration/Registration.js';
import { Author } from './dist/Features/Authors/Listing/Listing.js';
import { BookId } from './dist/Features/Books/BookId.js';
import { BookTitle, BookTitleValidator } from './dist/Features/Books/BookTitle.js';
import { AddBook, AddBookValidator, BookAdded } from './dist/Features/Books/Registration/Registration.js';
import { Book } from './dist/Features/Books/Listing/Listing.js';

// Every test gets a fresh event store; no globally shared streams or names.
const keepAlive = setInterval(() => {}, 1000);
try {
await test('Library author registration materializes a read model and enforces unique names', async () => {
    const scenario = ChronicleKernelScenario.for(RegisterAuthor,
        [AuthorRegistered, Author, AuthorNameValidator, UniqueAuthorName]);
    scenario.context.principal = { id: 'librarian', isAuthenticated: true, roles: ['Librarian'] };
    try {
        const id = AuthorId.create();
        const name = new AuthorName('Octavia Butler');
        const result = await scenario.execute({ id, name });
        result.shouldBeSuccessful();
        result.shouldHaveAppendedEvent(AuthorRegistered, id.toString(), event => event.name.value === name.value);
        const commandCausation = result.appendedEvents[0].context.causation.find(entry => entry.type === 'Arc.Command');
        assert.equal(commandCausation?.properties['Value.id'], id.toString(), 'Guid concept recorded in persisted causation');
        const model = await scenario.shouldHaveReadModel(Author, id.toString(), value => value.name.value === name.value);
        assert.equal(model.id.toString(), id.toString());
        const conflict = await scenario.execute({ id: AuthorId.create(), name });
        conflict.shouldNotBeSuccessful();
        assert.equal(conflict.validationResults[0]?.reason, 'constraintViolation');
    } finally { await scenario.dispose(); }
});

await test('Library book registration seeds a book and projects the new book', async () => {
    const scenario = ChronicleKernelScenario.for(AddBook,
        [BookAdded, Book, BookTitleValidator, AddBookValidator]);
    try {
        const authorId = AuthorId.create();
        const seededId = BookId.create();
        await scenario.given.events({ eventSourceId: seededId.toString(), event: new BookAdded(authorId, new BookTitle('Sula')) });
        await scenario.shouldHaveReadModel(Book, seededId.toString(), book => book.title.value === 'Sula');
        const bookId = BookId.create();
        const result = await scenario.execute({ bookId, authorId, title: new BookTitle('Beloved') });
        result.shouldBeSuccessful();
        result.shouldHaveAppendedEvent(BookAdded, bookId.toString(), event => event.title.value === 'Beloved');
        await scenario.shouldHaveReadModel(Book, bookId.toString(), book => book.authorId.toString() === authorId.toString());
        const invalid = await scenario.execute({ bookId: BookId.create(), authorId, title: new BookTitle('') });
        invalid.shouldNotBeSuccessful();
    } finally { await scenario.dispose(); }
});
} finally { clearInterval(keepAlive); }
