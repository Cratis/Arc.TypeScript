// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { ReadModelScenario, UnsupportedProjectionOperation } from '@cratis/chronicle/testing';
import sinon from 'sinon';
import { a_chronicle_query, BalanceChanged } from '../given/a_chronicle_query.js';

describe('when a projection evaluator rejects a query with its SDK error', given(a_chronicle_query, context => {
    let scenario: ReturnType<typeof context.create>;
    let failure: UnsupportedProjectionOperation;
    let caught: unknown;
    beforeEach(async () => {
        failure = new UnsupportedProjectionOperation('ProjectedBalance', 'From[0]', '@fromEvent', 'requires a kernel-backed test');
        sinon.stub(ReadModelScenario.prototype, 'instanceForEventSourceId').rejects(failure);
        scenario = context.create('projected');
        scenario.given.forEventSource('source-a').events(new BalanceChanged(2));
        try { await scenario.perform({ id: 'source-a' }); } catch (error) { caught = error; }
    });
    afterEach(async () => { await scenario.dispose(); sinon.restore(); });
    it('should throw the same error instance through the query pipeline', () => {
        (caught === failure).should.equal(true);
    });
}));
