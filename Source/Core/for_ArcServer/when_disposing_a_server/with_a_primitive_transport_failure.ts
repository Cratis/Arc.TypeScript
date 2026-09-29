// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when WebSocket teardown throws a primitive during server shutdown', () => {
    let withoutParticipants: unknown;
    let withParticipants: unknown;
    beforeEach(async () => {
        const plain = new ArcServer({});
        plain.closeWebSockets = () => { throw 'transport failed'; };
        withoutParticipants = await captureFailure(plain.dispose());

        const participating = new ArcServer({});
        participating.closeWebSockets = () => { throw 'transport failed'; };
        participating.services.addShutdownParticipant({ stop: () => {}, drain: async () => {} });
        withParticipants = await captureFailure(participating.dispose());
    });
    it('should report the single transport failure without participants', () => {
        should().equal(withoutParticipants, 'transport failed');
    });
    it('should report the single transport failure with participants', () => {
        (withParticipants as AggregateError).errors.should.deep.equal(['transport failed']);
    });
});
