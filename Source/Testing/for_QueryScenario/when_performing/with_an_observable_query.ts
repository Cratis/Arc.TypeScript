// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { query, readModel } from '@cratis/arc.core';
import { QueryScenario } from '../../QueryScenario.js';
import { StreamingQueryNotSupportedError } from '../../StreamingQueryNotSupportedError.js';

const invoked = vi.fn();
@readModel()
class StreamQuery {
    @query({ observable: true })
    static watch() { invoked(); return { subscribe: () => ({ unsubscribe() {} }) }; }
}

describe('when performing a declared streaming query as a snapshot', () => {
    let scenario: QueryScenario;
    let failure: unknown;
    beforeEach(async () => {
        invoked.mockClear();
        scenario = QueryScenario.for(StreamQuery, 'watch');
        try { await scenario.perform(); } catch (error) { failure = error; }
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should reject before invoking the producer', () => { invoked.mock.calls.should.have.lengthOf(0); });
    it('should direct the caller to an observable scenario', () => {
        (failure instanceof StreamingQueryNotSupportedError).should.equal(true);
        (failure as Error).name.should.equal('StreamingQueryNotSupportedError');
        (failure as Error).message.should.contain('ObservableQueryScenario');
    });
});
