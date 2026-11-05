// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { query, readModel } from '@cratis/arc.core';
import { map, type Observable } from 'rxjs';
import { TickerClock } from '../TickerClock.js';

/** A tick of the server clock. */
@readModel()
export class Ticker {
    @field(Number) tick!: number;
    @field(String) time!: string;

    @query()
    static observe(clock: TickerClock): Observable<Ticker> {
        return clock.ticks().pipe(map(tick => ({ tick: tick + 1, time: new Date().toISOString() })));
    }
}
