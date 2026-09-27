// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Guid } from '@cratis/fundamentals';
import sinon from 'sinon';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AddBook } from '../../AddBook.proxy';
import { AddBookForm } from '../../AddBookForm';

describe('when submitting a book with a title', () => {
    const authorId = Guid.create();
    let command: AddBook;
    let execute: sinon.SinonStub;

    beforeEach(async () => {
        command = new AddBook();
        execute = sinon.stub(command, 'execute').resolves({ isSuccess: true, validationResults: [] } as never);
        sinon.stub(AddBook, 'use').returns([command, values => Object.assign(command, values), sinon.stub()]);
        render(<AddBookForm authorId={authorId} />);
        fireEvent.change(screen.getByRole('textbox', { name: 'New book' }), { target: { value: '  Kindred  ' } });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add' })); });
    });

    afterEach(() => { cleanup(); sinon.restore(); });

    it('should execute with the author, a new book id, and the trimmed title', async () => {
        await waitFor(() => execute.callCount.should.equal(1));
        command.authorId.should.equal(authorId);
        command.title.should.equal('Kindred');
        String(command.bookId).length.should.be.greaterThan(0);
    });

    it('should clear the form and show a success message', async () => {
        await waitFor(() => screen.getByRole('status').textContent!.should.equal('Book added.'));
        (screen.getByRole('textbox', { name: 'New book' }) as HTMLInputElement).value.should.equal('');
    });
});
