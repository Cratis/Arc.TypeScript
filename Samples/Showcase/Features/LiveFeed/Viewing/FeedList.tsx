// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useState } from 'react';
import { All } from './All.proxy';
import { ByAuthor } from './ByAuthor.proxy';

/** Every message, live, and a second subscription filtered by an author argument. */
export function FeedList() {
    const [author, setAuthor] = useState('ada');
    const [all] = All.use();
    const [byAuthor] = ByAuthor.use({ author });
    return <div className="columns">
        <div><h3>Everyone</h3><ul>{all.data.map(message => <li key={message.id}><b>{message.author}</b> {message.text}</li>)}</ul></div>
        <div><h3>Only <input aria-label="Filter author" value={author} onChange={event => setAuthor(event.target.value)} /></h3>
            <ul>{byAuthor.data.map(message => <li key={message.id}>{message.text}</li>)}</ul></div>
    </div>;
}
