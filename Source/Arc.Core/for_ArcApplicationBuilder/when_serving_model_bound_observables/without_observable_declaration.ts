// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CurrentValueSubject, query, readModel } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@readModel()
class UndeclaredObservable {
    @query()
    static All(): CurrentValueSubject<string[]> { return CurrentValueSubject.of(['private']); }
}

describe('when a snapshot query returns an undeclared observable', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        const builder = context.create();
        builder.add(UndeclaredObservable);
        const application = await builder.build();
        try { result = (await application.server.handle(new Request('http://localhost/api/all')))!; }
        finally { await application.dispose(); }
    });
    it('should reject the undeclared observable instead of serializing internal state', () => {
        result.status.should.equal(500);
    });
}));
