// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { authorize, command } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@authorize()
@command()
class AuthenticatedCommand { handle(): string { return 'secret'; } }

describe('when an anonymous caller reaches a model-bound authorize declaration', given(an_application_builder, context => {
    let status: number;
    beforeEach(async () => {
        const builder = context.create();
        builder.add(AuthenticatedCommand);
        const application = await builder.build();
        try {
            status = (await application.server.handle(new Request('http://localhost/api/authenticated-command', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
            })))!.status;
        } finally { await application.dispose(); }
    });
    it('should deny access without exposing the result', () => { status.should.equal(403); });
}));
