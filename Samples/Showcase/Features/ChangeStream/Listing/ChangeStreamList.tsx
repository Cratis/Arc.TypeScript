// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { IncrementButton } from '../Updating/IncrementButton';
import { RemoveItemButton } from '../Removing/RemoveItemButton';
import { All } from './All.proxy';

/** The items, plus the add/replace/remove change set of the latest emission. */
export function ChangeStreamList() {
    const [result] = All.use();
    const changes = All.useChangeStream(item => item.id);
    return <div className="columns">
        <ul>{result.data.map(item => <li key={item.id}>{item.name}: {item.value} <IncrementButton id={item.id} value={item.value} /> <RemoveItemButton id={item.id} /></li>)}</ul>
        <div><h3>Latest change set</h3>
            <p>added {changes.added.map(item => item.name).join(', ') || '—'}</p>
            <p>replaced {changes.replaced.map(item => `${item.name}=${item.value}`).join(', ') || '—'}</p>
            <p>removed {changes.removed.map(item => item.name).join(', ') || '—'}</p></div>
    </div>;
}
