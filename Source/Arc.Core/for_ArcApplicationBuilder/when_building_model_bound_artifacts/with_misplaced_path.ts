// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, path } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

@command()
class UnroutedCommand {
    @path('/api/incorrect')
    handle(): void {}
}

describe('when placing a path on a command method', given(an_application_builder, context => {
    let error: unknown;
    beforeEach(async () => {
        const builder = context.create();
        builder.add(UnroutedCommand);
        try { const application = await builder.build(); await application.dispose(); }
        catch (failure) { error = failure; }
    });
    it('should reject the path before serving any requests', () => {
        (error as Error).message.should.contain('@path on UnroutedCommand.handle');
    });
}));
