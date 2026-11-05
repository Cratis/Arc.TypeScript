// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useState, type FormEvent } from 'react';
import { PostToFeed } from './PostToFeed.proxy';

/** Post a message; the validator rejects an empty or overlong text. */
export function PostForm() {
    const [command, setValues] = PostToFeed.use();
    const [author, setAuthor] = useState('ada');
    const [text, setText] = useState('');
    const [problems, setProblems] = useState<string[]>([]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setValues({ author, text });
        const result = await command.execute();
        setProblems(result.isSuccess ? [] : result.validationResults.map(validation => validation.message));
        if (result.isSuccess) setText('');
    };

    return <form onSubmit={submit}>
        <input aria-label="Author" value={author} onChange={event => setAuthor(event.target.value)} />
        <input aria-label="Message" value={text} placeholder="Say something" onChange={event => setText(event.target.value)} />
        <button type="submit">Post</button>
        {problems.map(problem => <p key={problem} className="problem">{problem}</p>)}
    </form>;
}
