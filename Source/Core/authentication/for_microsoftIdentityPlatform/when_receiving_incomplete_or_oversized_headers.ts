// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { microsoftIdentityPlatform } from '../microsoftIdentityPlatform.js';
import { AuthenticationStatus } from '../AuthenticationStatus.js';

describe('when receiving incomplete or oversized EasyAuth headers', () => {
    let statuses: AuthenticationStatus[];
    beforeEach(async () => {
        const authenticate = microsoftIdentityPlatform();
        const request = (headers: Record<string, string>) => new Request('https://arc.example/api', { headers });
        const payload = Buffer.from(JSON.stringify({ identityProvider: 'aad' })).toString('base64');
        const partial = await authenticate(request({ 'x-ms-client-principal-id': 'alice', 'x-ms-client-principal': payload }));
        const oversized = await authenticate(request({ 'x-ms-client-principal-id': 'alice', 'x-ms-client-principal-name': 'Alice',
            'x-ms-client-principal': 'A'.repeat(64 * 1024 + 4) }));
        const empty = await authenticate(request({ 'x-ms-client-principal-id': '', 'x-ms-client-principal-name': 'Alice',
            'x-ms-client-principal': payload }));
        statuses = [partial.status, oversized.status, empty.status];
    });
    it('should ignore partial forwarding', () => { statuses[0]!.should.equal(AuthenticationStatus.Anonymous); });
    it('should reject an oversized principal', () => { statuses[1]!.should.equal(AuthenticationStatus.Failed); });
    it('should reject an empty identity', () => { statuses[2]!.should.equal(AuthenticationStatus.Failed); });
});
