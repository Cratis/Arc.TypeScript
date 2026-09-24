// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, denied, type Outcome } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@command()
class DeniedPreparation {
    static executions = 0;
    provide(): Outcome<never> { return denied('not allowed'); }
    handle(prepared: unknown): string { DeniedPreparation.executions++; return String(prepared); }
}

describe('when preparation denies a model-bound command', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        DeniedPreparation.executions = 0;
        const builder = context.create();
        builder.add(DeniedPreparation);
        const application = await builder.build();
        try {
            result = (await application.server.handle(new Request('http://localhost/api/denied-preparation', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
            })))!;
        } finally { await application.dispose(); }
    });
    it('should return forbidden', () => { result.status.should.equal(403); });
    it('should not run the handler', () => { DeniedPreparation.executions.should.equal(0); });
}));
