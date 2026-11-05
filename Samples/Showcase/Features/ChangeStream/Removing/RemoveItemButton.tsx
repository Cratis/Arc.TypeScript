// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { RemoveChangeStreamItem } from './RemoveChangeStreamItem.proxy';

export function RemoveItemButton({ id }: { id: number }) {
    const [command, setValues] = RemoveChangeStreamItem.use();
    return <button onClick={() => { setValues({ id }); void command.execute(); }}>Remove</button>;
}
