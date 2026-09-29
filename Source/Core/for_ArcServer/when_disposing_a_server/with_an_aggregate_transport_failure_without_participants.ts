// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline, captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when transport teardown rejects with an aggregate without participants', () => {
    let failure: unknown;
    let original: AggregateError;
    beforeEach(async () => {
        const server = new ArcServer({});
        original = new AggregateError([new Error('socket failure')], 'Arc WebSocket shutdown failed');
        server.closeWebSockets = async () => { throw original; };
        failure = await beforeDeadline(captureFailure(server.dispose()), 'aggregate transport shutdown');
    });
    it('should throw the original aggregate rather than duplicate its leaf', () => {
        should().equal(failure, original);
        (failure as AggregateError).errors.should.deep.equal(original.errors);
    });
});
