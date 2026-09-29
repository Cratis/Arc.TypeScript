// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline, captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when transport teardown throws synchronously without participants', () => {
    let failure: unknown;
    let closes: number;
    let transportError: Error;
    beforeEach(async () => {
        closes = 0;
        const server = new ArcServer({});
        transportError = new Error('synchronous transport failure');
        server.closeWebSockets = () => { closes++; throw transportError; };
        failure = await beforeDeadline(captureFailure(server.dispose()), 'synchronous transport shutdown');
        await captureFailure(server.dispose());
    });
    it('should preserve the original failure and tear down transport exactly once', () => {
        should().equal(failure, transportError);
        closes.should.equal(1);
    });
});
