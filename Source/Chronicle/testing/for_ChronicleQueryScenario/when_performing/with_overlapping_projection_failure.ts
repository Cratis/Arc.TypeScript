// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { argument, query, readModel, service } from '@cratis/arc.core';
import { UnsupportedProjectionOperation } from '@cratis/chronicle/testing';
import { ChronicleReadModels } from '../../../ChronicleReadModels.js';
import { ChronicleQueryScenario } from '../../ChronicleQueryScenario.js';
import { BalanceChanged, ProjectedBalance, UnsupportedBalance } from '../given/a_chronicle_query.js';

let reachedUnsupported: () => void;
let releaseUnsupported: Promise<void>;
let originalError: unknown;

@readModel() class CompetingQueries {
    @query(argument('id', String), service(ChronicleReadModels))
    static async byId(id: string, models: ChronicleReadModels): Promise<ProjectedBalance | null> {
        if (id !== 'unsupported') return models.getById(ProjectedBalance, id);
        try {
            await models.getById(UnsupportedBalance, id);
            return null;
        }
        catch (error) {
            originalError = error;
            reachedUnsupported();
            await releaseUnsupported;
            throw error;
        }
    }
}

describe('when an unsupported projection lookup overlaps a pinned lookup', () => {
    let scenario: ChronicleQueryScenario<ProjectedBalance | null>;
    let pinnedResult: Awaited<ReturnType<typeof scenario.perform>> | undefined;
    let pinnedFailure: unknown;
    let unsupportedFailure: unknown;
    beforeEach(async () => {
        let release!: () => void;
        const unsupportedReached = new Promise<void>(resolve => { reachedUnsupported = resolve; });
        releaseUnsupported = new Promise<void>(resolve => { release = resolve; });
        scenario = ChronicleQueryScenario.for(CompetingQueries, 'byId', BalanceChanged, ProjectedBalance, UnsupportedBalance);
        scenario.given.forEventSource('unsupported').events(new BalanceChanged(2));
        scenario.givenReadModel(ProjectedBalance, 'pinned', Object.assign(new ProjectedBalance(), { amount: 3 }));
        const unsupported = scenario.perform({ id: 'unsupported' }).then(() => undefined, error => error as unknown);
        try {
            await unsupportedReached;
            try { pinnedResult = await scenario.perform({ id: 'pinned' }); }
            catch (error) { pinnedFailure = error; }
        } finally { release(); }
        unsupportedFailure = await unsupported;
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should leave the pinned query successful', () => {
        (pinnedFailure === undefined).should.equal(true);
        pinnedResult!.isSuccess.should.equal(true);
        pinnedResult!.data!.amount.should.equal(3);
    });
    it('should propagate the original SDK error to the unsupported query', () => {
        (unsupportedFailure instanceof UnsupportedProjectionOperation).should.equal(true);
        (unsupportedFailure === originalError).should.equal(true);
    });
});
