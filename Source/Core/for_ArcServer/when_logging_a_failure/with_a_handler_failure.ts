// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import sinon from 'sinon';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';

should();

describe('when logging a handler failure with a working logger', () => {
    let server: ArcServer;
    let logged: sinon.SinonSpy;
    let response: Response | null;
    let text: string;

    beforeEach(async () => {
        logged = sinon.spy();
        server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}),
            handle: () => { throw Error('private failure detail'); } })],
        logger: error => { logged(error); } });
        response = await server.handle(new Request('http://arc.invalid/api/save', { method: 'POST', body: '{}',
            headers: { 'X-Correlation-ID': crypto.randomUUID() } }));
        text = await response!.text();
    });
    afterEach(async () => server.dispose());

    it('should return a server failure', () => response!.status.should.equal(500));
    it('should log once', () => logged.callCount.should.equal(1));
    it('should log the original error', () => (logged.firstCall.args[0] as Error).message.should.equal('private failure detail'));
    it('should redact the failure body', () => text.should.not.contain('private failure detail'));
});
