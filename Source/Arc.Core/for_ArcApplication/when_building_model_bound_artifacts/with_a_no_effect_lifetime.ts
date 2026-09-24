// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, singleton } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@singleton()
@command()
class DecoratedCommand { handle(): void {} }

describe('when assigning a service lifetime to a model-bound command', given(an_application_builder, context => {
    let error: unknown;
    beforeEach(async () => {
        const builder = context.create();
        builder.add(DecoratedCommand);
        try { const application = await builder.build(); await application.dispose(); }
        catch (failure) { error = failure; }
    });
    it('should reject the no-effect service lifetime', () => {
        (error as Error).message.should.contain('has no effect');
    });
}));
