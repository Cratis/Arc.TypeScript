// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, inject, transient } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@transient()
class TransientDependency {
    static created = 0;
    readonly id = ++TransientDependency.created;
}

@command()
class TransientCommand {
    @inject(TransientDependency, TransientDependency)
    handle(first: TransientDependency, second: TransientDependency): number[] { return [first.id, second.id]; }
}

describe('when injecting a transient service twice', given(an_application_builder, context => {
    let response: number[];
    beforeEach(async () => {
        TransientDependency.created = 0;
        const builder = context.create();
        builder.add(TransientDependency, TransientCommand);
        const application = await builder.build();
        try {
            const result = (await application.server.handle(new Request('http://localhost/api/transient-command', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
            })))!;
            response = (await result.json()).response as number[];
        } finally { await application.dispose(); }
    });
    it('should provide distinct instances to each parameter', () => {
        response.should.have.lengthOf(2);
        response[0]!.should.not.equal(response[1]!);
    });
}));
