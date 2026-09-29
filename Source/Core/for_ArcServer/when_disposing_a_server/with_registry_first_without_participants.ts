// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when a server is disposed after a participant-free registry shutdown', () => {
    let closes: number;
    beforeEach(async () => {
        closes = 0;
        const server = new ArcServer({});
        server.closeWebSockets = async () => { closes++; };
        await beforeDeadline(server.services.dispose(), 'registry-first shutdown');
        await beforeDeadline(server.dispose(), 'server after registry shutdown');
        await beforeDeadline(server.dispose(), 'repeat server shutdown');
    });
    it('should not repeat the transport teardown', () => closes.should.equal(1));
});
