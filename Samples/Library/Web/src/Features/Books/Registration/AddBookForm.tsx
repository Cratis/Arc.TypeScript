// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useState, type FormEvent } from 'react';
import { Guid } from '@cratis/fundamentals';
import { AddBook } from '../../../generated/Books/Registration/AddBook.proxy';

export function AddBookForm({ authorId }: { authorId: Guid }) {
    const [command, setValues] = AddBook.use();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setValues({ bookId: Guid.create(), authorId, title: title.trim() });
        const result = await command.execute();
        if (result.isSuccess) { setTitle(''); setMessage('Book added.'); }
        else setMessage(result.validationResults.map(item => item.message).join(' ') || 'Could not add book.');
    };
    return <form className="book-form" onSubmit={event => void submit(event)}>
        <label htmlFor={`title-${authorId}`}>New book</label>
        <div className="inline"><input id={`title-${authorId}`} value={title} onChange={event => setTitle(event.target.value)} placeholder="Book title" required />
            <button type="submit">Add</button></div><p role="status">{message}</p></form>;
}
