// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CurrentValueSubject, query, readModel } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@readModel()
class LiveInventory {
    @query({ observable: true })
    static All(): CurrentValueSubject<string[]> { return CurrentValueSubject.of(['ready']); }
}

describe('when reading a model-bound observable query snapshot', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        const builder = context.create();
        builder.add(LiveInventory);
        const application = await builder.build();
        try { result = (await application.server.handle(new Request('http://localhost/api/all')))!; }
        finally { await application.dispose(); }
    });
    it('should encode the current value', async () => {
        (await result.json()).data.should.deep.equal(['ready']);
    });
}));
