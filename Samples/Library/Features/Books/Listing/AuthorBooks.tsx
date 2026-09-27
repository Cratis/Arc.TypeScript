// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Guid } from '@cratis/fundamentals';
import { BooksForAuthor } from '../../../generated/Books/Listing/BooksForAuthor.proxy';
import { AddBookForm } from '../Registration/AddBookForm';

export function AuthorBooks({ authorId }: { authorId: Guid }) {
    const [books] = BooksForAuthor.use({ authorId });
    return <><ul className="books">{books.data.map(book => <li key={String(book.id)}>{book.title}</li>)}</ul>
        <AddBookForm authorId={authorId} /></>;
}
