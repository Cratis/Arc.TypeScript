// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { ReadModelScenario } from '@cratis/chronicle/testing';
import { ChronicleScenarioReadModels } from '../../ChronicleScenarioReadModels.js';
import { BalanceChanged, ProjectedBalance } from '../given/a_chronicle_query.js';
import { InferredAmount, InferredAmountChanged, InferredAmountProjection, UnbackedName } from '../../given/inferred_projection.js';

class an_older_chronicle_sdk {
    readonly models = new ChronicleScenarioReadModels([BalanceChanged, ProjectedBalance], () => undefined,
        async () => ({ ReadModelScenario }));
}

describe('when reading a projection with an older Chronicle SDK', given(an_older_chronicle_sdk, context => {
    let failure: unknown;
    beforeEach(async () => {
        context.models.given.forEventSource('source-a').events(new BalanceChanged(2));
        try { await context.models.forTenant('Default').findInstanceById(ProjectedBalance, 'source-a'); }
        catch (error) { failure = error; }
    });
    it('should require SDK 6.19.0 rather than evaluate the projection', () => {
        (failure as Error).message.should.contain('@cratis/chronicle >= 6.19.0');
    });
}));

describe('when an older Chronicle SDK sees an unrelated untyped projection', () => {
    let failure: unknown;
    beforeEach(async () => {
        const models = new ChronicleScenarioReadModels([InferredAmountChanged, UnbackedName, InferredAmountProjection],
            () => undefined, async () => ({ ReadModelScenario }));
        models.given.forEventSource('source-a').events(new InferredAmountChanged(2));
        try { await models.forTenant('Default').findInstanceById(UnbackedName, 'source-a'); }
        catch (error) { failure = error; }
    });
    it('should fail because the projection cannot be associated without the evaluator', () => {
        (failure as Error).message.should.contain('@cratis/chronicle >= 6.19.0');
        (failure as Error).message.should.contain("@projection('', ReadModel)");
    });
});

for (const { missing, loadTesting } of [
    { missing: 'testing subpath', loadTesting: async () => { throw Object.assign(new Error('not exported'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' }); } },
    { missing: 'ReadModelScenario', loadTesting: async () => ({ ReadModelScenario: undefined as unknown as typeof ReadModelScenario }) },
    { missing: 'UnsupportedProjectionOperation', loadTesting: async () => ({ ReadModelScenario }) }
]) {
    describe(`when a matching inferred projection lacks ${missing} in the Chronicle SDK`, () => {
        let failure: unknown;
        beforeEach(async () => {
            const models = new ChronicleScenarioReadModels([InferredAmountChanged, InferredAmount, InferredAmountProjection],
                () => undefined, loadTesting);
            models.given.forEventSource('source-a').events(new InferredAmountChanged(2));
            try { await models.forTenant('Default').findInstanceById(InferredAmount, 'source-a'); }
            catch (error) { failure = error; }
        });
        it('should fail explicitly instead of treating the model as missing', () => {
            (failure as Error).message.should.contain('@cratis/chronicle >= 6.19.0');
            (failure as Error).message.should.contain("@projection('', ReadModel)");
        });
    });
}

describe('when seeded history has no projection or reducer candidate', () => {
    let instance: unknown;
    beforeEach(async () => {
        const models = new ChronicleScenarioReadModels([InferredAmountChanged, UnbackedName],
            () => undefined, async () => { throw new Error('The testing evaluator should not load'); });
        models.given.forEventSource('source-a').events(new InferredAmountChanged(2));
        instance = await models.forTenant('Default').findInstanceById(UnbackedName, 'source-a');
    });
    it('should return null without loading the evaluator', () => {
        (instance == null).should.equal(true);
    });
});

describe('when an untyped projection has no seeded history for the requested source', () => {
    let instance: unknown;
    beforeEach(async () => {
        const models = new ChronicleScenarioReadModels([InferredAmountChanged, InferredAmount, InferredAmountProjection],
            () => undefined, async () => { throw new Error('The testing evaluator should not load'); });
        models.given.forEventSource('source-a').events(new InferredAmountChanged(2));
        instance = await models.forTenant('Default').findInstanceById(InferredAmount, 'source-b');
    });
    it('should return null without loading the evaluator', () => {
        (instance == null).should.equal(true);
    });
});

describe('when the Chronicle testing subpath is unavailable for a projection', () => {
    let failure: unknown;
    beforeEach(async () => {
        const models = new ChronicleScenarioReadModels([BalanceChanged, ProjectedBalance], () => undefined,
            async () => { throw Object.assign(new Error('not exported'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' }); });
        models.given.forEventSource('source-a').events(new BalanceChanged(2));
        try { await models.forTenant('Default').findInstanceById(ProjectedBalance, 'source-a'); }
        catch (error) { failure = error; }
    });
    it('should name SDK 6.19.0 as the minimum for a projection', () => {
        (failure as Error).message.should.contain('@cratis/chronicle >= 6.19.0');
    });
});

describe('when the Chronicle testing subpath lacks ReadModelScenario for a projection', () => {
    let failure: unknown;
    beforeEach(async () => {
        const models = new ChronicleScenarioReadModels([BalanceChanged, ProjectedBalance], () => undefined,
            async () => ({ ReadModelScenario: undefined as unknown as typeof ReadModelScenario }));
        models.given.forEventSource('source-a').events(new BalanceChanged(2));
        try { await models.forTenant('Default').findInstanceById(ProjectedBalance, 'source-a'); }
        catch (error) { failure = error; }
    });
    it('should name SDK 6.19.0 as the minimum for a projection', () => {
        (failure as Error).message.should.contain('@cratis/chronicle >= 6.19.0');
    });
});
