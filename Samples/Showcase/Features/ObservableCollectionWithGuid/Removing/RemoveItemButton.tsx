// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Guid } from '@cratis/fundamentals';
import { RemoveObservableCollectionWithGuidItem } from './RemoveObservableCollectionWithGuidItem.proxy';

export function RemoveItemButton({ id }: { id: Guid }) {
    const [command, setValues] = RemoveObservableCollectionWithGuidItem.use();
    return <button onClick={() => { setValues({ id }); void command.execute(); }}>Remove</button>;
}
