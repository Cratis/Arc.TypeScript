// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer, defineCommand, defineQuery, microsoftIdentityPlatform, microsoftIdentityClaims } from '@cratis/arc.core';
import { hosts, socket, startHost } from './given/a_real_identity_host.js';

should();
const client = (id: string, department: string) => Buffer.from(JSON.stringify({ identityProvider: 'aad', userId: 'ignored',
    userDetails: 'Alice', userRoles: ['Reader'], claims: [
        { typ: 'sub', val: 'forged' }, { typ: 'urn:cratis:arc:identity:provider', val: 'forged' },
        { typ: 'department', val: department }
    ] })).toString('base64');
const headers = (id: string, department: string) => ({
    'x-ms-client-principal': client(id, department), 'x-ms-client-principal-id': id,
    'x-ms-client-principal-name': 'Header Name'
});

for (const host of hosts) describe(`when ${host} authorizes a named policy through HTTP`, () => {
    let missing: Awaited<ReturnType<typeof socket>>;
    let denied: typeof missing;
    let granted: typeof missing;
    let query: typeof missing;
    let malformed: typeof missing;
    let redacted: typeof missing;
    let unconfigured: typeof missing;
    beforeEach(async () => {
        const arc = new ArcServer({ authentication: [microsoftIdentityPlatform()],
            authorizationPolicies: { Finance: async (principal) => {
                if ((principal.claims as Record<string, string>).department === 'explode') throw new Error('private policy secret');
                return (principal.claims as Record<string, string>).department === 'finance' && principal.id === 'alice' &&
                (principal.claims as Record<string, string>).sub === 'alice' &&
                (principal.claims as Record<string, string>)[microsoftIdentityClaims.provider] === 'aad';
            } },
            commands: [defineCommand({ name: 'Secret', schema: z.object({}), authorization: { policy: 'Finance', authenticated: true },
                handle: () => 'secret' })],
            queries: [defineQuery({ name: 'Reading', schema: z.object({}), authorization: { policy: 'Finance', authenticated: true },
                perform: () => 'read' })] });
        const listener = await startHost(host, arc, { secure: false, decorated: true });
        try {
            missing = await socket(listener.port, false, '/api/secret', {}, 'POST', '{}');
            denied = await socket(listener.port, false, '/api/secret', headers('alice', 'sales'), 'POST', '{}');
            granted = await socket(listener.port, false, '/api/secret', headers('alice', 'finance'), 'POST', '{}');
            query = await socket(listener.port, false, '/api/reading', headers('alice', 'finance'));
            malformed = await socket(listener.port, false, '/api/secret', { ...headers('alice', 'finance'), 'x-ms-client-principal': 'not base64' }, 'POST', '{}');
            redacted = await socket(listener.port, false, '/api/secret', headers('alice', 'explode'), 'POST', '{}');
            unconfigured = await socket(listener.port, false, '/foreign', headers('alice', 'finance'));
        } finally { await listener.close(); await arc.dispose(); }
    });
    it('should challenge an unauthenticated caller before parsing the body', () => { missing.status.should.equal(401); });
    it('should forbid a caller outside the policy', () => { denied.status.should.equal(403); });
    it('should authorize a caller with sanitized identity claims', () => { granted.status.should.equal(200); });
    it('should authorize a query using the same policy', () => { query.status.should.equal(200); });
    it('should reject a malformed forwarded principal', () => { malformed.status.should.equal(401); });
    it('should redact an exception from a policy', () => {
        redacted.status.should.equal(500);
        redacted.body.should.not.contain('private policy secret');
    });
    it('should leave foreign routes with the host', () => { unconfigured.status.should.equal(200); });
});
