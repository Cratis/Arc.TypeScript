// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import sinon from 'sinon';
import { a_recorded_connection } from '../given/a_recorded_connection.js';

should();

describe('when sending keep-alive with keep-alive disabled', () => {
    let clock: sinon.SinonFakeTimers;
    let context: a_recorded_connection;
    let connection: ReturnType<a_recorded_connection['connection']>;
    let advertised: number | undefined;
    let count: number;

    beforeEach(async () => {
        clock = sinon.useFakeTimers();
        context = new a_recorded_connection();
        connection = context.connection(0, 'SSE');
        await connection.connect();
        advertised = context.output.frames[0]?.keepAliveIntervalMs;
        await clock.tickAsync(60_000);
        count = context.output.frames.length;
    });

    afterEach(async () => { await connection.close(); await context.server.dispose(); clock.restore(); });

    it('should advertise a zero interval', () => { advertised?.should.equal(0); });
    it('should never schedule a ping', () => { count.should.equal(1); });
});
