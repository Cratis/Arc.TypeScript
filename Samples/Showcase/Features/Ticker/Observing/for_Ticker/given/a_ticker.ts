// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ObservableQueryScenario } from '@cratis/arc.testing';
import { ReplaySubject } from 'rxjs';
import { TickerClock } from '../../../TickerClock.js';
import { Ticker } from '../../Observing.js';
import { metadata } from '../../../../generatedMetadata.js';

export class a_ticker {
    ticks = new ReplaySubject<number>();
    clock = Object.assign(new TickerClock(), { ticks: () => this.ticks.asObservable() });
    observable = ObservableQueryScenario.for<{ tick: number; time: string }>(Ticker, 'observe');

    constructor() {
        this.observable.extend(builder => builder.useGeneratedMetadata(metadata));
        this.observable.services.addSingleton(TickerClock, this.clock);
    }
}
