// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';

should();
describe('when registering commands with duplicate definitions', () => {
    let error: unknown;
    beforeEach(() => {
        const command = defineCommand({ name: 'Save', schema: z.object({ value: z.number() }), handle: value => value.value });
        try { new ArcServer({ commands: [command, command] }); } catch (caught) { error = caught; }
    });
    it('should reject the duplicate', () => (error instanceof Error).should.equal(true));
});
