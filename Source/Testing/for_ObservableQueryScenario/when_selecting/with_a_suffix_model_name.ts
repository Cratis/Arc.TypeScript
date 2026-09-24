// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CurrentValueSubject, path, query, readModel } from '@cratis/arc.core';
import { ObservableQueryScenario } from '../../index.js';

@readModel()
@path('/api/item-observe')
class Item { @query({ observable: true }) static find(): CurrentValueSubject<string> { return CurrentValueSubject.of('item'); } }
@readModel()
@path('/api/pending-item-observe')
class PendingItem { @query({ observable: true }) static find(): CurrentValueSubject<string> { return CurrentValueSubject.of('pending'); } }

describe('when selecting an observable query beside a model with a suffix name', () => {
    let scenario: ObservableQueryScenario<string>;
    let value: string | undefined;
    beforeEach(async () => {
        scenario = ObservableQueryScenario.for<string>(Item, 'find', PendingItem);
        value = (await scenario.collect(1, 100)).emissions[0]?.data;
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should select the exact model rather than reject an ambiguous suffix', () => { value!.should.equal('item'); });
});
