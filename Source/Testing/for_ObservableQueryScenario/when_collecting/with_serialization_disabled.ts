// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs } from '@cratis/fundamentals';
import { argument, CurrentValueSubject, query, readModel } from '@cratis/arc.core';
import { ObservableQueryScenario } from '../../index.js';

class Code extends ConceptAs<string> { static readonly valueType = String; }
@readModel()
class CodeItem {
    @query({ observable: true }, argument('code', Code))
    static observe(code: Code): CurrentValueSubject<{ code: string; count: number }> {
        return CurrentValueSubject.of({ code: code.value, count: Number.NaN });
    }
}

describe('when collecting with JSON round trips disabled', () => {
    let scenario: ObservableQueryScenario<{ code: string; count: number }>;
    let result: { code: string; count: number } | undefined;
    beforeEach(async () => {
        scenario = ObservableQueryScenario.for<{ code: string; count: number }>(CodeItem, 'observe')
            .withSerializationRoundTrip(false);
        result = (await scenario.collect(1, 100, { code: new Code('alpha') })).emissions[0]?.data;
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should encode concept arguments despite disabling JSON', () => { result!.code.should.equal('alpha'); });
    it('should preserve non-JSON emission data', () => { Number.isNaN(result!.count).should.be.true; });
});
