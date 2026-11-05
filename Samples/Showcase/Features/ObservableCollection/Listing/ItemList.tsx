// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { RemoveItemButton } from '../Removing/RemoveItemButton';
import { All } from './All.proxy';

export function ItemList() {
    const [result] = All.use();
    return <ul>{result.data.map(item => <li key={item.id}>{item.name} <RemoveItemButton id={item.id} /></li>)}</ul>;
}
