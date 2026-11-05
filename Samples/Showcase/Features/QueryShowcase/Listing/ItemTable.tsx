// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { All } from './All.proxy';

/** Server-side sorting and paging of an array: Arc applies `sortBy`, `sortDirection`, `page` and `pageSize`. */
export function ItemTable() {
    const [result, , setSorting, setPage] = All.useWithPaging(8);
    const { page, totalPages, totalItems } = result.paging;
    return <div><h3>Paged and sorted</h3>
        <p>
            <button onClick={() => setSorting(All.sortBy.name.ascending)}>Name ↑</button>
            <button onClick={() => setSorting(All.sortBy.name.descending)}>Name ↓</button>
            <button onClick={() => setSorting(All.sortBy.createdAt.descending)}>Newest first</button>
        </p>
        <table><thead><tr><th>Id</th><th>Name</th><th>Category</th><th>Created</th></tr></thead>
            <tbody>{result.data.map(item => <tr key={item.id}><td>{item.id}</td><td>{item.name}</td><td>{item.category}</td><td>{item.createdAt.slice(0, 10)}</td></tr>)}</tbody></table>
        <p><button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button> page {page + 1} of {totalPages} ({totalItems} rows)
            <button disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next</button></p>
    </div>;
}
