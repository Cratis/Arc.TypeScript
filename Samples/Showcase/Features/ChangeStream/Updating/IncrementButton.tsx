// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { UpdateChangeStreamItem } from './UpdateChangeStreamItem.proxy';

export function IncrementButton({ id, value }: { id: number; value: number }) {
    const [command, setValues] = UpdateChangeStreamItem.use();
    return <button onClick={() => { setValues({ id, value: value + 1 }); void command.execute(); }}>+1</button>;
}
