// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import { hosts, socket, startHost } from './given/a_real_identity_host.js';

should();

for (const host of hosts) describe(`when ${host} native callback throws and logging rejects`, () => {
    let responses: Awaited<ReturnType<typeof socket>>[];
    let provided: number;
    let executed: number;
    let logged: unknown[];
    const correlation = 'c5aa55a1-1234-4567-890a-abcdef012345';

    beforeEach(async () => {
        logged = [];
        provided = 0;
        executed = 0;
        const arc = new ArcServer({ nativePrincipal: true,
            identityDetails: { schema: z.object({}), provide: () => { provided++; return {}; } },
            queries: [defineQuery({ name: 'Protected', schema: z.object({}), perform: () => { executed++; return 1; } })],
            logger: (error, id) => {
                logged.push({ error, id });
                if (host === 'Express') throw new Error('logging failed');
                return Promise.reject(new Error('logging failed'));
            }
        });
        const listener = await startHost(host, arc, { native: () => { throw Error('private native callback'); } });
        try {
            responses = [];
            for (const path of ['/.cratis/me', '/api/protected'])
                responses.push(await socket(listener.port, false, path, { 'x-correlation-id': correlation }));
        } finally { await listener.close(); }
    });

    it('should return an error on both paths', () => { responses.every(result => result.status === 500).should.equal(true); });
    it('should preserve the correlation header', () => {
        responses.every(result => result.headers['x-correlation-id'] === correlation).should.equal(true);
    });
    it('should not expose the native callback failure', () => {
        responses.every(result => !result.body.includes('private native callback')).should.equal(true);
    });
    it('should return a redacted error', () => {
        responses.every(result => result.body.includes('An unexpected error occurred')).should.equal(true);
    });
    it('should not invoke the identity provider', () => { provided.should.equal(0); });
    it('should not execute the query', () => { executed.should.equal(0); });
    it('should log both errors', () => { logged.should.have.length(2); });
    it('should use the supplied correlation for logging', () => {
        logged.every(entry => (entry as { id: string }).id === correlation).should.equal(true);
    });
});
