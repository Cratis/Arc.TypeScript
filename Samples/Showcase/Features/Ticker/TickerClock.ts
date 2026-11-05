// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { interval, startWith, type Observable } from 'rxjs';

/** The source of ticks; a spec replaces it with a controllable one. */
export class TickerClock {
    /** Emit 0 immediately, then a counting tick every second. */
    ticks(): Observable<number> { return interval(1_000).pipe(startWith(-1)); }
}
