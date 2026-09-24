// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderSource } from '../../renderSource.js';
import { given } from '../../given.js';
import { a_captured_contract } from '../given/a_captured_contract.js';

// Kotlin's parity record documents the captured scalar command-generic correction.
describe('when rendering captured command and query shapes', given(a_captured_contract, context => {
    let output: ReadonlyMap<string, string>;
    beforeEach(() => { output = renderSource(context.analysis); });
    it('should match the captured command route, roles and response constructor', () => {
        const command = output.get('differential/fixture/commands/CreateFixtures.ts')!;
        command.should.contain("readonly route: string = '/api/commands/create-fixtures'");
        command.should.contain("readonly roles: string[] = ['creator', 'admin']");
        command.should.contain('super(FixtureModel, true)');
        command.should.contain('Command<ICreateFixtures, FixtureModel[]>');
    });
    it('should match the captured snapshot route, identity and paging hooks', () => {
        const query = output.get('differential/fixture/models/All.ts')!;
        query.should.contain("readonly route: string = '/api/models/all'");
        query.should.contain("readonly queryName: string = 'differential.fixture.models.FixtureModel.all'");
        query.should.contain('static useWithPaging(pageSize: number');
    });
    it('should match the captured observable identity and required input', () => {
        const query = output.get('differential/fixture/models/Observe.ts')!;
        query.should.contain("readonly queryName: string = 'differential.fixture.models.FixtureModel.observe'");
        query.should.contain("new ParameterDescriptor('filter', String, false)");
        query.should.contain('ObservableQueryFor<FixtureModel[], ObserveParameters>');
    });
    it('should match the captured custom route and parameterized snapshot', () => {
        const query = output.get('differential/fixture/models/Search.ts')!;
        query.should.contain("readonly route: string = '/custom/fixture-search'");
        query.should.contain("readonly roles: string[] = ['viewer', 'auditor']");
        query.should.contain('QueryFor<FixtureModel[], SearchParameters>');
    });
}));
