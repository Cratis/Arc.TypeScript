// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Observe } from './Observe.proxy';

/** The server clock, pushed once a second. */
export function TickerView() {
    const [result] = Observe.use();
    return <section><h2>Ticker</h2>
        <p>An observable query over an RxJS interval. Every connection receives a tick each second.</p>
        {result.data ? <p className="big">Tick {result.data.tick} · {result.data.time}</p> : <p>Waiting for the first tick…</p>}
    </section>;
}
