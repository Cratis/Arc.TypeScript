// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('when selecting an author in the catalog', () => {
    beforeEach(() => {
        vi.stubGlobal('ResizeObserver', ResizeObserverStub);
        sinon.stub(BooksForAuthor, 'use').returns([{ data: [] }] as unknown as ReturnType<typeof BooksForAuthor.use>);
        vi.mocked(useObservableQueryWithPaging).mockReturnValue([
            { data: [{ id: 'author-1', name: 'Octavia Butler' }], paging: { page: 0, totalPages: 1, totalItems: 1 } },
            vi.fn(), vi.fn(), vi.fn()
        ] as unknown as ReturnType<typeof useObservableQueryWithPaging>);
        render(<CratisComponentsProvider value={{ locale: 'en-US' }}><AuthorCatalog /></CratisComponentsProvider>);
        fireEvent.click(screen.getByRole('row', { name: /Octavia Butler/ }));
    });

    afterEach(() => { cleanup(); sinon.restore(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

    it('should show the selected author’s shelf', () => {
        screen.getByRole('heading', { name: "Octavia Butler's shelf" }).textContent!.should.equal("Octavia Butler's shelf");
    });
});
