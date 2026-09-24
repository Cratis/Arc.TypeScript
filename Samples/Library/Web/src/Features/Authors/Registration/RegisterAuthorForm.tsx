// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useState, type FormEvent } from 'react';
import { Guid } from '@cratis/fundamentals';
import { RegisterAuthor } from '../../../generated/Authors/Registration/RegisterAuthor.proxy';

export function RegisterAuthorForm() {
    const [command, setValues] = RegisterAuthor.use();
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setValues({ id: Guid.create(), name: name.trim() });
        // Setters update the command instance before execution; use the instance itself for the result.
        const result = await command.execute();
        if (result.isSuccess) { setName(''); setMessage('Author registered.'); }
        else setMessage(result.validationResults.map(item => item.message).join(' ') || 'Registration failed.');
    };
    return <form onSubmit={event => void submit(event)}><label htmlFor="author-name">Name</label>
        <input id="author-name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Octavia Butler" required />
        <button type="submit">Register author</button><p role="status">{message}</p></form>;
}
