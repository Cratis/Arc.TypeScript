// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';

describe('when a command fails with exception exposure enabled', () => {
    let message: string;
    beforeEach(async () => {
        const server = new ArcServer({ exposeExceptionDetails: true,
            commands: [defineCommand({ name: 'Fail', schema: z.object({}), handle: () => { throw Error('visible detail'); } })] });
        try {
            const result = await server.handle(new Request('http://localhost/api/fail', { method: 'POST', body: '{}' }));
            message = (await result!.json()).exceptionMessages[0];
        } finally { await server.dispose(); }
    });
    it('should include the original failure', () => { message.should.contain('visible detail'); });
});
