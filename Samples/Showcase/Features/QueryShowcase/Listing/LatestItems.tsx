// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Latest } from './Latest.proxy';

export function LatestItems() {
    const [result] = Latest.use();
    return <div><h3>Latest</h3><ul>{result.data.map(item => <li key={item.id}>{item.name}</li>)}</ul></div>;
}
