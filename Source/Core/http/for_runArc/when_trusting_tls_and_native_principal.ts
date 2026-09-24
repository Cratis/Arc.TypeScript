// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { runArc } from '../runArc.js';
import { cert, key } from '../../given/tls-fixture.js';
import { exchange, portOf } from './given/a_node_host.js';

should();

describe('when trusting TLS and native principal instead of forwarded headers', () => {
    let plainStatus: number;
    let plainCookie: string;
    let secureStatus: number;
    let secureCookie: string;

    beforeEach(async () => {
        const arc = new ArcServer({ nativePrincipal: true, identityDetails: { schema: z.object({}), provide: () => ({}) } });
        const native = () => ({ principal: { id: 'host', roles: [], isAuthenticated: true } });
        const plain = await runArc(arc, { port: 0, native });
        const tls = await runArc(arc, { port: 0, https: { cert, key }, native });
        try {
            const http = await exchange(portOf(plain.server), '/.cratis/me', 'GET', { 'x-forwarded-proto': 'https' });
            plainStatus = http.status;
            plainCookie = String(http.headers['set-cookie']);
            const https = await exchange(portOf(tls.server), '/.cratis/me', 'GET', { 'x-forwarded-proto': 'http' }, undefined, true);
            secureStatus = https.status;
            secureCookie = String(https.headers['set-cookie']);
        } finally { await plain.close(); await tls.close(); await arc.dispose(); }
    });

    it('should accept the native principal on HTTP', () => { plainStatus.should.equal(200); });
    it('should omit Secure for plain HTTP', () => { plainCookie.should.not.contain('Secure'); });
    it('should accept the native principal on HTTPS', () => { secureStatus.should.equal(200); });
    it('should include Secure for trusted TLS', () => { secureCookie.should.contain('Secure'); });
});
