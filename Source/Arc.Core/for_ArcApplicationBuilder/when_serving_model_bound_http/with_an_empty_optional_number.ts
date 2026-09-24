// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { argument, query, readModel } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@readModel()
class OptionalCount {
    @query(argument('count', Number, { optional: true }))
    static Get(count: number | undefined): boolean { return count === undefined; }
}

describe('when GET supplies an empty optional non-string argument', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        const builder = context.create();
        builder.add(OptionalCount);
        const application = await builder.build();
        try { result = (await application.server.handle(new Request('http://localhost/api/get?count=')))!; }
        finally { await application.dispose(); }
    });
    it('should bind the value as absent instead of rejecting the request', async () => {
        (await result.json()).data.should.equal(true);
    });
}));
