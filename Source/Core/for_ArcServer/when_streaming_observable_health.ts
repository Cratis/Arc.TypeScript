// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { an_admitted_health_subscription } from './given/an_admitted_health_subscription.js';

should();

describe('when streaming observable health after subscription admission', () => {
    let context: an_admitted_health_subscription;
    let initial: number;
    let latest: number;

    beforeEach(async () => {
        context = new an_admitted_health_subscription();
        const health = await context.server.handle(new Request('http://localhost/.cratis/queries/health', {
            headers: { authorization: 'alice', accept: 'text/event-stream' }
        }));
        const reader = health!.body!.getReader();
        const decode = (bytes?: Uint8Array): { data: { totalSubscriptions: number } } =>
            JSON.parse(new TextDecoder().decode(bytes).slice(6)) as { data: { totalSubscriptions: number } };
        initial = decode((await reader.read()).value).data.totalSubscriptions;
        await context.subscribe();
        context.subscribed?.status.should.equal(200);
        latest = 0;
        for (let index = 0; index < 4 && latest === 0; index++)
            latest = decode((await reader.read()).value).data.totalSubscriptions;
        await reader.cancel();
    });

    afterEach(async () => { await context.close(); });

    it('should begin with no subscriptions', () => { initial.should.equal(0); });
    it('should report the admitted subscription', () => { latest.should.equal(1); });
});
