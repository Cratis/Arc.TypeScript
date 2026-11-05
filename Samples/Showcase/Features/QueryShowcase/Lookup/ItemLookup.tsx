// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useState } from 'react';
import { ByCategory } from './ByCategory.proxy';
import { ById } from './ById.proxy';

/** Queries with arguments. Each hook re-queries when its argument changes. */
export function ItemLookup() {
    const [id, setId] = useState(3);
    const [category, setCategory] = useState('Games');
    const [item] = ById.use({ id });
    const [items] = ByCategory.use({ category });
    return <div className="columns">
        <div><h3>By id <input aria-label="Id" type="number" min={1} value={id} onChange={event => setId(Number(event.target.value))} /></h3>
            <p>{item.data ? `${item.data.name} (${item.data.category})` : 'No such item'}</p></div>
        <div><h3>By category <select aria-label="Category" value={category} onChange={event => setCategory(event.target.value)}>
            {['Books', 'Games', 'Music', 'Tools'].map(name => <option key={name}>{name}</option>)}</select></h3>
            <p>{items.data.map(entry => entry.name).join(', ')}</p></div>
    </div>;
}
