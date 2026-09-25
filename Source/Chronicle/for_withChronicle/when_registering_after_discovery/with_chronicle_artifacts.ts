// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult, QueryResult } from '@cratis/arc.core';
import { given } from '../../given.js';
import { a_discovered_application } from '../given/a_discovered_application.js';
import { Item } from '../given/discovery/Artifacts.js';

describe('when registering Chronicle after discovery with Chronicle artifacts', given(a_discovered_application, context => {
    let result: { command: CommandResult; query: QueryResult };
    beforeEach(async () => { result = await context.exercise(); });
    it('should append the command event', () => { context.appended.should.have.lengthOf(1); });
    it('should execute the command successfully', () => { result.command.isSuccess.should.equal(true); });
    it('should resolve the read-model query', () => {
        const data = result.query.data as Item[];
        data.should.deep.equal([context.item]);
    });
}));
