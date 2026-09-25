// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { TenantResolverType } from '../../tenancy/TenantResolverType.js';
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';

should();
describe('when configuring tenancy with invalid sources', () => {
    let failures: unknown[];
    beforeEach(() => {
        const capture = (configure: () => ArcServer) => { try { configure(); return undefined; } catch (error) { return error; } };
        failures = [
            () => new ArcServer({ tenancy: { sources: [TenantResolverType.Subdomain], baseDomain: '127.0.0.1' } }),
            () => new ArcServer({ tenancy: { sources: [TenantResolverType.Subdomain], baseDomain: 'example.com:443' } }),
            () => new ArcServer({ tenancy: { sources: [TenantResolverType.Fixed], fixedTenantId: '../north' } }),
            () => new ArcServer({ tenancy: { sources: [TenantResolverType.Header, TenantResolverType.Header] } })
        ].map(capture);
    });
    it('should reject unsafe or duplicate tenant sources', () => failures.forEach(error => (error instanceof Error).should.equal(true)));
});
