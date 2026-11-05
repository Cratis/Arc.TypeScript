// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useState, type FormEvent } from 'react';
import { AddObservableCollectionItem } from './AddObservableCollectionItem.proxy';

export function AddItemForm() {
    const [command, setValues] = AddObservableCollectionItem.use();
    const [name, setName] = useState('');
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setValues({ name });
        if ((await command.execute()).isSuccess) setName('');
    };
    return <form onSubmit={submit}><input aria-label="Name" value={name} placeholder="Item name" onChange={event => setName(event.target.value)} /><button type="submit">Add</button></form>;
}
