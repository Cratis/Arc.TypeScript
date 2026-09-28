// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ChronicleCommandScenario } from '../../ChronicleCommandScenario.js';
import { CheckInferredAmount, InferredAmount, InferredAmountChanged, InferredAmountProjection } from '../../given/inferred_projection.js';

describe('when executing with an inferred declarative projection', () => {
    let scenario: ChronicleCommandScenario<CheckInferredAmount>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = ChronicleCommandScenario.for(CheckInferredAmount, InferredAmountChanged, InferredAmount, InferredAmountProjection);
        scenario.given.forEventSource('source-a').events(new InferredAmountChanged(2));
        result = await scenario.execute({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should inject the model inferred by the SDK from seeded history', () => {
        result.isSuccess.should.equal(true);
        (result.response as number).should.equal(2);
    });
});
