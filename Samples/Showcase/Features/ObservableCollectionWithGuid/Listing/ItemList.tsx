// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { RemoveItemButton } from '../Removing/RemoveItemButton';
import { All } from './All.proxy';

export function ItemList() {
    const [result] = All.use();
    return <ul>{result.data.map(item => <li key={item.id.toString()}>{item.name} <code>{item.id.toString().slice(0, 8)}</code> <RemoveItemButton id={item.id} /></li>)}</ul>;
}
