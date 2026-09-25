// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../../dependencyInjection/ServiceLifetime.js';
import { field } from '@cratis/fundamentals';
import { should } from 'vitest';
import { given } from '../../../given.js';
import { ArcApplication } from '../../../ArcApplication.js';
import { serviceToken } from '../../../dependencyInjection/ServiceToken.js';
import { query } from '../../modelBound/query.js';
import { readModel } from '../../modelBound/readModel.js';
import type { ReadModelInterceptor } from '../../ReadModelInterceptor.js';
should();

@readModel()
class PascalMetric {
    @field(String) RecordedValue!: string;
    @query()
    static All(): PascalMetric[] {
        return ['z', 'a'].map(value => Object.assign(new PascalMetric(), { RecordedValue: value }));
    }
}
class a_pascal_case_page {
    readonly seen: string[] = [];
    readonly token = serviceToken<ReadModelInterceptor>('pascal page interceptor');
    async request(): Promise<{ data: { recordedValue: string }[]; paging: { totalItems: number } }> {
        const builder = ArcApplication.createBuilder({ services: [{ token: this.token, lifetime: ServiceLifetime.Scoped, factory: () => ({
            model: PascalMetric, intercept: (item: object) => {
                this.seen.push((item as PascalMetric).RecordedValue);
                return item;
            }
        }) }], readModelInterceptors: [this.token] });
        builder.add(PascalMetric);
        const application = await builder.build();
        try {
            const response = (await application.server.handle(new Request(`http://localhost${application.server.queries[0]!.route}?page=0&pageSize=1&sortBy=recordedValue&sortDirection=asc`)))!;
            return await response.json() as { data: { recordedValue: string }[]; paging: { totalItems: number } };
        } finally { await application.dispose(); }
    }
}
describe('when rendering a snapshot with a Pascal-case sort', given(a_pascal_case_page, context => {
    let result: { data: { recordedValue: string }[]; paging: { totalItems: number } };
    beforeEach(async () => { result = await context.request(); });
    it('should sort by the client wire name before intercepting the selected item', () => {
        result.data.should.deep.equal([{ recordedValue: 'a' }]);
        context.seen.should.deep.equal(['a']);
    });
    it('should retain the full total', () => { result.paging.totalItems.should.equal(2); });
}));
