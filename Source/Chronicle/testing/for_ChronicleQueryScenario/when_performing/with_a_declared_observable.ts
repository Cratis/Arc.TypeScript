// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_chronicle_query } from '../given/a_chronicle_query.js';

describe('when performing a declared Chronicle observable query', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create>;
    let failure: unknown;
    beforeEach(async () => {
        scenario = context.create('stream');
        try { await scenario.perform(); } catch (error) { failure = error; }
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should require the kernel scenario for observation', () => {
        (failure as Error).message.should.contain('ChronicleKernelScenario for observation');
        (failure as Error).message.should.not.contain('ObservableQueryScenario');
    });
}));
