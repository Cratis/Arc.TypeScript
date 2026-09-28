// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { cleanup, render, screen } from '@testing-library/react';
import { Guid } from '@cratis/fundamentals';
import sinon from 'sinon';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AddBook } from '../../../Registration/AddBook.proxy';
import { BooksForAuthor } from '../../BooksForAuthor.proxy';
import { AuthorBooks } from '../../AuthorBooks';

describe('when showing an author shelf with books', () => {
    const authorId = Guid.create();
    let useBooks: sinon.SinonStub;

    beforeEach(() => {
        useBooks = sinon.stub(BooksForAuthor, 'use').returns([{ data: [
            { id: Guid.create(), authorId, title: 'Kindred' },
            { id: Guid.create(), authorId, title: 'Parable of the Sower' }
        ] }] as unknown as ReturnType<typeof BooksForAuthor.use>);
        sinon.stub(AddBook, 'use').returns([new AddBook(), sinon.stub(), sinon.stub()] as ReturnType<typeof AddBook.use>);
        render(<AuthorBooks authorId={authorId} />);
    });

    afterEach(() => { cleanup(); sinon.restore(); });

    it('should request the selected author’s books', () => {
        useBooks.firstCall.args[0].authorId.should.equal(authorId);
    });

    it('should list the books on that author’s shelf', () => {
        screen.getByText('Kindred').textContent!.should.equal('Kindred');
        screen.getByText('Parable of the Sower').textContent!.should.equal('Parable of the Sower');
    });
});
