// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();

describe('when subscribing to SSE with rejected admission', () => {
    let denied: Response | null;
    let invalid: Response | null;

    beforeEach(async () => {
        const privateServer = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Private', schema: z.object({ count: z.number() }),
            authorization: { authenticated: true }, observe: () => new CurrentValueSubject<number>()
        })] });
        denied = await privateServer.handle(new Request('http://localhost/api/private?count=1', {
            headers: { accept: 'text/event-stream' }
        }));
        const invalidServer = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({ count: z.number() }), observe: () => new CurrentValueSubject<number>()
        })] });
        invalid = await invalidServer.handle(new Request('http://localhost/api/value', {
            headers: { accept: 'text/event-stream' }
        }));
        await privateServer.dispose();
        await invalidServer.dispose();
    });

    it('should deny unauthorized subscriptions', () => { denied?.status.should.equal(403); });
    it('should send JSON for authorization denial', () => { denied?.headers.get('content-type')?.should.contain('application/json'); });
    it('should reject invalid subscriptions', () => { invalid?.status.should.equal(400); });
    it('should send JSON for invalid requests', () => { invalid?.headers.get('content-type')?.should.contain('application/json'); });
});
