// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

class LoggingService {}
@command()
class UnboundCommand {
    handle(logging: LoggingService): void { void logging; }
}

describe('when building without generated metadata for an unbound command', given(an_application_builder, context => {
    let error: unknown;
    beforeEach(async () => {
        const builder = context.create();
        builder.add(UnboundCommand);
        try { await builder.build(); }
        catch (failure) { error = failure; }
    });
    it('should reject the missing binding rather than guessing from erased types', () => {
        (error as Error).message.should.contain('Unbound handle parameters');
    });
}));
