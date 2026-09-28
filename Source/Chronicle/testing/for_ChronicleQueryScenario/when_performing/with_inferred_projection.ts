// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ChronicleQueryScenario } from '../../ChronicleQueryScenario.js';
import { InferredAmount, InferredAmountChanged, InferredAmountProjection, InferredAmountQueries, UnbackedName } from '../../given/inferred_projection.js';

describe('when performing a query with an inferred declarative projection', () => {
    let scenario: ChronicleQueryScenario<{ amount: number }>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = ChronicleQueryScenario.for(InferredAmountQueries, 'byId', InferredAmountChanged, InferredAmount, InferredAmountProjection);
        scenario.given.forEventSource('source-a').events(new InferredAmountChanged(2));
        result = await scenario.perform({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should return the model inferred by the SDK from seeded history', () => {
        result.isSuccess.should.equal(true);
        result.data!.amount.should.equal(2);
    });
});

describe('when performing a query for a model not matched by an inferred projection', () => {
    let scenario: ChronicleQueryScenario<UnbackedName | null>;
    let result: Awaited<ReturnType<typeof scenario.perform>>;
    beforeEach(async () => {
        scenario = ChronicleQueryScenario.for(InferredAmountQueries, 'unbacked', InferredAmountChanged,
            InferredAmount, UnbackedName, InferredAmountProjection);
        scenario.given.forEventSource('source-a').events(new InferredAmountChanged(2));
        result = await scenario.perform({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should return null for a genuinely unbacked read model', () => {
        result.isSuccess.should.equal(true);
        (result.data == null).should.equal(true);
    });
});
