// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '@cratis/arc.core';
import { hosts, socket, startHost } from './given/a_real_identity_host.js';

should();

const principal = { id: 'test', name: 'Élise 🌍', roles: ['Reader'], isAuthenticated: true };
const provider = { schema: z.object({ label: z.string() }), provide: () => ({ label: 'naïve 東京' }) };

for (const host of hosts) describe(`when ${host} verifies a native principal`, () => {
    let unverified: number;
    let invalidStatus: number;
    let verifiedStatus: number;

    beforeEach(async () => {
        let verified = false;
        let invalid = false;
        const arc = new ArcServer({ nativePrincipal: true, identityDetails: provider });
        const listener = await startHost(host, arc, { native: () => ({ principal: verified ? invalid ?
            { ...principal, roles: 'Reader' as unknown as readonly string[] } : principal : undefined }) });
        try {
            unverified = (await socket(listener.port, false, '/.cratis/me', { 'x-forwarded-user': 'test', 'x-user-id': 'test' })).status;
            verified = true;
            invalid = true;
            invalidStatus = (await socket(listener.port, false, '/.cratis/me')).status;
            invalid = false;
            verifiedStatus = (await socket(listener.port, false, '/.cratis/me')).status;
        } finally { await listener.close(); }
    });

    it('should ignore unverified client headers', () => { unverified.should.equal(401); });
    it('should reject an invalid host principal', () => { invalidStatus.should.equal(500); });
    it('should accept an explicitly verified host principal', () => { verifiedStatus.should.equal(200); });
});
