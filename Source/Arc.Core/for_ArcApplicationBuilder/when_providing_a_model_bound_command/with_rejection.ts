// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, rejected, type Outcome } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@command()
class RejectedPreparation {
    static executions = 0;
    provide(): Outcome<never> { return rejected({ severity: 3, reason: 'rule', message: 'Denied by policy', members: [] }); }
    handle(prepared: unknown): string { RejectedPreparation.executions++; return String(prepared); }
}

describe('when preparation rejects a model-bound command', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        RejectedPreparation.executions = 0;
        const builder = context.create();
        builder.add(RejectedPreparation);
        const application = await builder.build();
        try {
            result = (await application.server.handle(new Request('http://localhost/api/rejected-preparation', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
            })))!;
        } finally { await application.dispose(); }
    });
    it('should report invalid input', () => { result.status.should.equal(400); });
    it('should not run the handler', () => { RejectedPreparation.executions.should.equal(0); });
}));
