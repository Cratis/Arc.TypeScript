// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { AuthenticationStatus } from '../../authentication/AuthenticationStatus.js';
import { identityGet, identityPrincipal } from '../given/an_identity_request.js';

should();
describe('when issuing identity cookies with oversized details', () => {
    let rejected: { status: number; cookie: boolean; body: string; privateText: string }[];
    let accepted: { status: number; bytes: number; decoded: unknown; body: unknown };
    let lastAccepted: number;
    let firstRejected: number;
    let boundary: { status: number; bytes?: number; cookie: boolean }[];
    const create = (text: string) => new ArcServer({ authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal: identityPrincipal })],
        identityDetails: { schema: z.object({ text: z.string() }), provide: () => ({ text }) } });
    beforeEach(async () => {
        rejected = [];
        for (const text of ['x'.repeat(2980), '🌿'.repeat(480), 'Å'.repeat(500)]) {
            const server = create(text);
            const response = (await identityGet(server, '/.cratis/me'))!;
            rejected.push({ status: response.status, cookie: response.headers.has('set-cookie'), body: await response.text(), privateText: text.slice(0, 20) });
            await server.dispose();
        }
        const server = create('🌿'.repeat(230));
        const response = (await identityGet(server, '/.cratis/me'))!;
        const cookie = response.headers.get('set-cookie')!;
        accepted = { status: response.status, bytes: Buffer.byteLength(cookie), decoded: JSON.parse(atob(cookie.split(';')[0]!.split('=')[1]!)), body: await response.json() };
        await server.dispose();
        lastAccepted = firstRejected = 0;
        boundary = [];
        for (let count = 230; count <= 260; count++) {
            const candidate = create('🌿'.repeat(count));
            const result = (await identityGet(candidate, '/.cratis/me'))!;
            const bytes = result.headers.has('set-cookie') ? Buffer.byteLength(result.headers.get('set-cookie')!) : undefined;
            boundary.push({ status: result.status, bytes, cookie: result.headers.has('set-cookie') });
            if (result.status === 200) lastAccepted = count;
            else { firstRejected = count; await candidate.dispose(); break; }
            await candidate.dispose();
        }
    });
    it('should reject oversized identity data without publishing a partial cookie or private details', () => {
        rejected.should.have.lengthOf(3);
        for (const result of rejected) {
            result.status.should.equal(500);
            result.cookie.should.equal(false);
            result.body.should.not.contain(result.privateText);
        }
    });
    it('should preserve a client-decodable cookie under the header limit', () => {
        accepted.status.should.equal(200);
        accepted.bytes.should.be.at.most(4096);
        accepted.decoded!.should.deep.equal(accepted.body);
    });
    it('should reject precisely when the encoded header crosses its limit', () => {
        boundary.filter(result => result.status === 200).forEach(result => result.bytes!.should.be.at.most(4096));
        boundary.at(-1)!.status.should.equal(500);
        boundary.at(-1)!.cookie.should.equal(false);
        firstRejected.should.equal(lastAccepted + 1);
    });
});
