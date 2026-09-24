// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { path, query, readModel } from '@cratis/arc.core';
import { QueryScenario } from '../../index.js';

@readModel()
@path('/api/item-find')
class Item { @query() static find(): string { return 'item'; } }
@readModel()
@path('/api/pending-item-find')
class PendingItem { @query() static find(): string { return 'pending'; } }

describe('when selecting a query beside a model with a suffix name', () => {
    let scenario: QueryScenario<string>;
    let value: string | undefined;
    beforeEach(async () => {
        scenario = QueryScenario.for<string>(Item, 'find', PendingItem);
        value = (await scenario.perform()).data;
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should select the exact model rather than reject an ambiguous suffix', () => { value!.should.equal('item'); });
});
