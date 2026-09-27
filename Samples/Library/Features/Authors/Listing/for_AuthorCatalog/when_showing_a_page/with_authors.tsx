// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CratisComponentsProvider } from '@cratis/components';
import { useObservableQueryWithPaging } from '@cratis/arc.react/queries';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import sinon from 'sinon';
import { BooksForAuthor } from '../../../../Books/Listing/BooksForAuthor.proxy';
import { AllAuthors } from '../../AllAuthors.proxy';
import { AuthorCatalog } from '../../AuthorCatalog';

vi.mock('@cratis/arc.react/queries', async importOriginal => ({
    ...await importOriginal<typeof import('@cratis/arc.react/queries')>(),
    useObservableQueryWithPaging: vi.fn()
}));

class ResizeObserverStub {
    observe() { /* jsdom has no layout */ }
    disconnect() { /* jsdom has no layout */ }
}

describe('when showing authors in the catalog', () => {
    beforeEach(() => {
        vi.stubGlobal('ResizeObserver', ResizeObserverStub);
        sinon.stub(BooksForAuthor, 'use').returns([{ data: [] }] as unknown as ReturnType<typeof BooksForAuthor.use>);
        vi.mocked(useObservableQueryWithPaging).mockReturnValue([
            { data: [{ id: 'author-1', name: 'Octavia Butler' }, { id: 'author-2', name: 'Ursula Le Guin' }],
                paging: { page: 0, totalPages: 1, totalItems: 2 } }, vi.fn(), vi.fn(), vi.fn()
        ] as unknown as ReturnType<typeof useObservableQueryWithPaging>);
        render(<CratisComponentsProvider value={{ locale: 'en-US' }}><AuthorCatalog /></CratisComponentsProvider>);
    });

    afterEach(() => { cleanup(); sinon.restore(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

    it('should bind the observable query to a Cratis DataPage', () => {
        vi.mocked(useObservableQueryWithPaging).mock.calls[0][0].should.equal(AllAuthors);
        screen.getByRole('cell', { name: 'Octavia Butler' }).textContent!.should.equal('Octavia Butler');
        screen.getByRole('cell', { name: 'Ursula Le Guin' }).textContent!.should.equal('Ursula Le Guin');
    });

    it('should open the registration dialog from the Add author action', async () => {
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add author' })); });
        screen.getByRole('dialog', { name: 'Register an author' }).getAttribute('role')!.should.equal('dialog');
    });

    it('should show the selected author’s shelf', () => {
        fireEvent.click(screen.getByRole('row', { name: /Octavia Butler/ }));
        screen.getByRole('heading', { name: "Octavia Butler's shelf" }).textContent!.should.equal("Octavia Butler's shelf");
    });
});
