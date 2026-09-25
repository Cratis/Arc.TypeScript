// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { allowAnonymous, authorize, command } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@command()
@authorize()
class PublicCommand {
    @allowAnonymous()
    handle(): string { return 'public'; }
}

describe('when a command handler overrides class authorization', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        const builder = context.create();
        builder.add(PublicCommand);
        const application = await builder.build();
        try {
            result = (await application.server.handle(new Request('http://localhost/api/public-command', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
            })))!;
        } finally { await application.dispose(); }
    });
    it('should permit an anonymous caller', () => { result.status.should.equal(200); });
}));
