// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useEffect, useState } from 'react';
import { AllAuthors } from '../../../generated/Authors/Listing/AllAuthors.proxy';
import { AuthorsPage } from '../../../generated/Authors/Listing/AuthorsPage.proxy';
import { AuthorBooks } from '../../Books/Listing/AuthorBooks';

export function AuthorCatalog() {
    const [live] = AllAuthors.use();
    const [page, performPage, , setPage] = AuthorsPage.useWithPaging(5, AuthorsPage.sortBy.name.ascending);
    useEffect(() => { void performPage(); }, [live.data.length]);
    const [selected, setSelected] = useState<string>();
    const active = live.data.find(author => String(author.id) === selected);
    return <><p className="muted">{live.data.length} authors · updates without a reload</p>
        <ul className="authors">{page.data.map(author => <li key={String(author.id)}>
            <button className="author" onClick={() => setSelected(String(author.id))}>{author.name} <span>→</span></button>
        </li>)}</ul>
        <nav aria-label="Author pages"><button disabled={page.paging.page === 0} onClick={() => setPage(page.paging.page - 1)}>Previous</button>
            <span>Page {page.paging.page + 1} of {Math.max(1, page.paging.totalPages)}</span>
            <button disabled={page.paging.page + 1 >= page.paging.totalPages} onClick={() => setPage(page.paging.page + 1)}>Next</button></nav>
        {active && <div className="shelf"><h3>{active.name}'s shelf</h3><AuthorBooks authorId={active.id} /></div>}
    </>;
}
