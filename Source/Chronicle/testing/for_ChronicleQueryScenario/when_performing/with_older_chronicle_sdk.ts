// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { ReadModelScenario } from '@cratis/chronicle/testing';
import { ChronicleScenarioReadModels } from '../../ChronicleScenarioReadModels.js';
import { BalanceChanged, ProjectedBalance } from '../given/a_chronicle_query.js';

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
