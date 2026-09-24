// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { allowAnonymous, query, readModel, roles } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@roles('Admin')
@readModel()
class PublicLookup {
    @allowAnonymous()
    @query()
    static Get(): string { return 'public'; }
}

describe('when a model-bound query overrides class authorization', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        const builder = context.create();
        builder.add(PublicLookup);
        const application = await builder.build();
        try { result = (await application.server.handle(new Request('http://localhost/api/get')))!; }
        finally { await application.dispose(); }
    });
    it('should allow anonymous access to the method', () => { result.status.should.equal(200); });
}));
