// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { allowAnonymous, query, readModel, roles } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@allowAnonymous()
@readModel()
export class AnonymousLookup {
    @roles('Reader')
    @query()
    static Get(): string { return 'private'; }
}

describe('when a query method requires roles on an anonymous read model', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        const builder = context.create();
        builder.add(AnonymousLookup);
        const application = await builder.build();
        try { result = (await application.server.handle(new Request('http://localhost/api/get')))!; }
        finally { await application.dispose(); }
    });
    it('should enforce the method role', () => { result.status.should.equal(403); });
}));
