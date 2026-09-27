// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CratisComponentsProvider } from '@cratis/components';
import { useObservableQueryWithPaging } from '@cratis/arc.react/queries';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import sinon from 'sinon';
import { BooksForAuthor } from '../../../../Books/Listing/BooksForAuthor.proxy';
import { AuthorCatalog } from '../../AuthorCatalog';

vi.mock('@cratis/arc.react/queries', async importOriginal => ({
    ...await importOriginal<typeof import('@cratis/arc.react/queries')>(),
    useObservableQueryWithPaging: vi.fn()
}));

class ResizeObserverStub {
    observe() { /* jsdom has no layout */ }
    disconnect() { /* jsdom has no layout */ }
}

describe('when adding an author from the catalog', () => {
    beforeEach(async () => {
        vi.stubGlobal('ResizeObserver', ResizeObserverStub);
        sinon.stub(BooksForAuthor, 'use').returns([{ data: [] }] as unknown as ReturnType<typeof BooksForAuthor.use>);
        vi.mocked(useObservableQueryWithPaging).mockReturnValue([
            { data: [], paging: { page: 0, totalPages: 1, totalItems: 0 } }, vi.fn(), vi.fn(), vi.fn()
        ] as unknown as ReturnType<typeof useObservableQueryWithPaging>);
        render(<CratisComponentsProvider value={{ locale: 'en-US' }}><AuthorCatalog /></CratisComponentsProvider>);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add author' })); });
    });

    afterEach(() => { cleanup(); sinon.restore(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

    it('should open the registration dialog', () => {
        screen.getByRole('dialog', { name: 'Register an author' }).getAttribute('role')!.should.equal('dialog');
    });
});
