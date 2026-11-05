// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useState, type FormEvent } from 'react';
import { AddWatcherItem } from './AddWatcherItem.proxy';

export function AddItemForm() {
    const [command, setValues] = AddWatcherItem.use();
    const [name, setName] = useState('');
    const [problem, setProblem] = useState('');
    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setValues({ name });
        const result = await command.execute();
        setProblem(result.isSuccess ? '' : result.exceptionMessages.concat(result.validationResults.map(validation => validation.message)).join(' '));
        if (result.isSuccess) setName('');
    };
    return <form onSubmit={submit}><input aria-label="Item name" value={name} placeholder="Item" onChange={event => setName(event.target.value)} /><button type="submit">Add item</button>
        {problem && <p className="problem">{problem}</p>}</form>;
}
