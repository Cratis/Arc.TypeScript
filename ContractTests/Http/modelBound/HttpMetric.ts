// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { allowAnonymous, path, query, readModel } from '@cratis/arc.core';

@readModel({ namespace: 'HttpMetric' })
export class HttpMetric {
    @field(Number) HTTPCount!: number;
    @field(Number) RecordedValue!: number;
    @field(Number) State!: number;

    @allowAnonymous()
    @path('/api/http-metric')
    @query()
    static Current(): HttpMetric {
        return Object.assign(new HttpMetric(), { HTTPCount: Infinity, RecordedValue: NaN, State: 1 });
    }
}
