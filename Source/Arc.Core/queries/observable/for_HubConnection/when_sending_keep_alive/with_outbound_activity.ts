// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import sinon from 'sinon';
import { HubFrameType } from '../../HubFrameType.js';
import { a_recorded_connection } from '../given/a_recorded_connection.js';

should();

describe('when sending keep-alive with outbound activity', () => {
    let context: a_recorded_connection;
    let clock: sinon.SinonFakeTimers;
    let connection: ReturnType<a_recorded_connection['connection']>;
    let beforeIdle: number;
    let afterIdle: number;
    let elapsed: number;

    beforeEach(async () => {
        clock = sinon.useFakeTimers();
        context = new a_recorded_connection();
        connection = context.connection(1000, 'WebSocket');
        await connection.connect();
        await clock.tickAsync(500);
        await context.output.send({ type: HubFrameType.QueryResult });
        await clock.tickAsync(500);
        beforeIdle = context.output.frames.filter(frame => frame.type === HubFrameType.Ping).length;
        await clock.tickAsync(500);
        afterIdle = context.output.frames.filter(frame => frame.type === HubFrameType.Ping).length;
        elapsed = context.output.sentAt[2]! - context.output.sentAt[1]!;
    });

    afterEach(async () => { await connection.close(); await context.server.dispose(); clock.restore(); });

    it('should not ping before an entire idle interval', () => { beforeIdle.should.equal(0); });
    it('should ping after the idle interval', () => { afterIdle.should.equal(1); });
    it('should measure the interval from the last outbound frame', () => { (elapsed <= 1000).should.be.true; });
});
