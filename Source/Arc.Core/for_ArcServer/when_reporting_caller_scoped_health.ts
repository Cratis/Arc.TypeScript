// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { an_admitted_health_subscription } from './given/an_admitted_health_subscription.js';

should();

describe('when reporting caller-scoped observable health', () => {
    let context: an_admitted_health_subscription;
    let details: { totalConnections: number; totalSubscriptions: number;
        querySubscriptions: { queryName: string }[];
        connections: { subscriptions: { clientInfo: { userId: string; remoteIpAddress: string | null } }[] }[] };
    let bobConnections: number;
    let connectedType: string;
    let subscribedStatus: number | undefined;

    beforeEach(async () => {
        context = new an_admitted_health_subscription();
        await context.subscribe();
        connectedType = context.connectedType;
        subscribedStatus = context.subscribed?.status;
        const alice = await context.server.handle(new Request('http://localhost/.cratis/queries/health', {
            headers: { authorization: 'alice' }
        }));
        alice?.status.should.equal(200);
        details = (await alice!.json()).data;
        const bob = await context.server.handle(new Request('http://localhost/.cratis/queries/health', {
            headers: { authorization: 'bob' }
        }));
        bobConnections = (await bob!.json()).data.totalConnections;
    });

    afterEach(async () => { await context.close(); });

    it('should send a connected frame', () => { connectedType.should.equal('Connected'); });
    it('should accept the subscription', () => { subscribedStatus?.should.equal(200); });
    it('should report the caller connection count', () => { details.totalConnections.should.equal(1); });
    it('should report the caller subscription count', () => { details.totalSubscriptions.should.equal(1); });
    it('should identify the query', () => { details.querySubscriptions[0]?.queryName.should.equal('Numbers'); });
    it('should identify the owning principal', () => { details.connections[0]?.subscriptions[0]?.clientInfo.userId.should.equal('alice'); });
    it('should omit the unknown remote address', () => { should().equal(details.connections[0]?.subscriptions[0]?.clientInfo.remoteIpAddress, null); });
    it('should not reveal the connection to another caller', () => { bobConnections.should.equal(0); });
});
