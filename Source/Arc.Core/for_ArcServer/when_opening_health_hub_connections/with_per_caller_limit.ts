// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { healthServer } from '../given/a_health_server.js';

should();

describe('when opening health hub connections with a per-caller limit', () => {
    let statuses: (number | undefined)[];
    let limited: Response | null;

    beforeEach(async () => {
        const server = healthServer(8);
        const streams: Response[] = [];
        statuses = [];
        for (let index = 0; index < 8; index++) {
            const response = await server.handle(new Request('http://localhost/.cratis/queries/sse', {
                headers: { authorization: 'alice' }
            }));
            statuses.push(response?.status);
            streams.push(response!);
        }
        limited = await server.handle(new Request('http://localhost/.cratis/queries/sse', {
            headers: { authorization: 'alice' }
        }));
        for (const stream of streams) await stream.body?.cancel();
        await server.dispose();
    });

    it('should admit the first eight connections', () => { statuses.every(status => status === 200).should.equal(true); });
    it('should reject the next connection', () => { limited?.status.should.equal(503); });
    it('should send a retry-after header', () => { limited?.headers.get('retry-after')?.should.equal('1'); });
});
