// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useState, type FormEvent } from 'react';
import { AddWatcherNote } from './AddWatcherNote.proxy';

export function AddNoteForm() {
    const [command, setValues] = AddWatcherNote.use();
    const [text, setText] = useState('');
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setValues({ text });
        if ((await command.execute()).isSuccess) setText('');
    };
    return <form onSubmit={submit}><input aria-label="Note" value={text} placeholder="Note" onChange={event => setText(event.target.value)} /><button type="submit">Add note</button></form>;
}
