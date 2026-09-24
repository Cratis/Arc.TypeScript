// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { an_application_builder } from '../../../for_ArcApplicationBuilder/given/an_application_builder.js';
import { Search } from '../given/Search.js';
import { SearchArgumentsValidator } from '../given/SearchArgumentsValidator.js';

describe('when validating query arguments with an arguments model', given(an_application_builder, context => {
    let result: { validationResults: { members: string[]; message: string }[] };
    beforeEach(async () => {
        const builder = context.create({ development: true });
        builder.add(Search, SearchArgumentsValidator);
        const application = await builder.build();
        const response = await application.server.handle(new Request('http://localhost/api/by-term?term='));
        result = await response!.json();
        await application.dispose();
    });
    it('should report the query model member', () => {
        result.validationResults.map(issue => issue.members).should.deep.equal([['term']]);
    });
}));
