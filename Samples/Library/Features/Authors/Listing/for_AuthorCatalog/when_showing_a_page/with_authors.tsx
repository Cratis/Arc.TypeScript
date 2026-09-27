// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AllAuthors } from '../../AllAuthors.proxy';
import { AuthorsPage } from '../../AuthorsPage.proxy';
import { AuthorCatalog } from '../../AuthorCatalog';

describe('when showing a page of authors in the catalog', () => {
    const setPage = sinon.stub();

    beforeEach(() => {
        const authors = [{ id: 'author-1', name: 'Octavia Butler' }, { id: 'author-2', name: 'Ursula Le Guin' }];
        sinon.stub(AllAuthors, 'use').returns([{ data: authors }, sinon.stub()] as unknown as ReturnType<typeof AllAuthors.use>);
        sinon.stub(AuthorsPage, 'useWithPaging').returns([
            { data: authors, paging: { page: 0, totalPages: 2 } }, sinon.stub(), sinon.stub(), setPage, sinon.stub()
        ] as unknown as ReturnType<typeof AuthorsPage.useWithPaging>);
        render(<AuthorCatalog />);
    });

    afterEach(() => { cleanup(); sinon.restore(); setPage.reset(); });

    it('should render authors from the paged query result', () => {
        screen.getByRole('button', { name: /Octavia Butler/ }).textContent!.should.include('Octavia Butler');
        screen.getByRole('button', { name: /Ursula Le Guin/ }).textContent!.should.include('Ursula Le Guin');
    });

    it('should request the next page when clicked', () => {
        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        setPage.calledOnceWithExactly(1).should.equal(true);
    });
});
