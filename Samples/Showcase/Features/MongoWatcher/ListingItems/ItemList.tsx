// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ObserveItems } from './ObserveItems.proxy';

/** A live list driven by a MongoDB change stream of the current tenant's collection. */
export function ItemList() {
    const [result] = ObserveItems.use();
    return <ul>{result.data.map(item => <li key={item.id.toString()}>{item.name}</li>)}</ul>;
}
