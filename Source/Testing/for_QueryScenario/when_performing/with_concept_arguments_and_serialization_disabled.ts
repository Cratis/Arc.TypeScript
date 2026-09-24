// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs } from '@cratis/fundamentals';
import { argument, query, readModel } from '@cratis/arc.core';
import { QueryScenario } from '../../index.js';

class Code extends ConceptAs<string> { static readonly valueType = String; }
@readModel()
class Item {
    @query(argument('code', Code))
    static byCode(code: Code): string { return code.value; }
}

describe('when performing a query with a concept and JSON round trips disabled', () => {
    let scenario: QueryScenario<string>;
    let result: string | undefined;
    beforeEach(async () => {
        scenario = QueryScenario.for<string>(Item, 'byCode').withSerializationRoundTrip(false);
        result = (await scenario.perform({ code: new Code('alpha') })).data;
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should still encode the concept before the query pipeline', () => {
        result!.should.equal('alpha');
    });
});
