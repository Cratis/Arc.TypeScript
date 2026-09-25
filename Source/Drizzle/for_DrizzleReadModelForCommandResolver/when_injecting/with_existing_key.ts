// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_command_with_sqlite } from '../given/a_command_with_sqlite.js';

should();
describe('when injecting an existing Drizzle model into a command', given(a_command_with_sqlite, context => {
    let result: Awaited<ReturnType<typeof context.application.server.executeCommand>>;
    beforeEach(async () => {
        await context.establish();
        result = await context.application.server.executeCommand('RenameTask',
            { id: '00112233-4455-6677-8899-aabbccddeeff' }, context.identity());
    });
    afterEach(() => context.close());
    it('should return the tenant row from handle', () => {
        result.isSuccess.should.equal(true);
        (result.response as string).should.equal('z');
    });
}));
