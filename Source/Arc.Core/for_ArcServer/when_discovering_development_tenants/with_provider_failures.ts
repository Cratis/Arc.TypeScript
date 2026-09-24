// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { identityGet } from '../given/an_identity_request.js';

should();
describe('when discovering development tenants with provider failures', () => {
    let withoutDevelopment: unknown;
    let tenants: unknown;
    let failure: { status: number; body: string };
    let oversized: number;
    beforeEach(async () => {
        try { new ArcServer({ developmentTenants: () => [] }); } catch (error) { withoutDevelopment = error; }
        const server = new ArcServer({ development: true, developmentTenants: () => [{ id: 'north', name: 'North' }] });
        tenants = await (await identityGet(server, '/.cratis/tenants'))!.json();
        const failing = new ArcServer({ development: true, developmentTenants: () => { throw Error('private tenant'); } });
        const response = (await identityGet(failing, '/.cratis/tenants'))!;
        failure = { status: response.status, body: await response.text() };
        const tooMany = new ArcServer({ development: true, developmentTenants: () => Array.from({ length: 101 }, (_, index) => ({ id: String(index), name: 'tenant' })) });
        oversized = (await identityGet(tooMany, '/.cratis/tenants'))!.status;
        await Promise.all([server.dispose(), failing.dispose(), tooMany.dispose()]);
    });
    it('should restrict tenant discovery to development mode', () => (withoutDevelopment instanceof Error).should.equal(true));
    it('should return explicit development tenants', () => tenants!.should.deep.equal([{ id: 'north', name: 'North' }]));
    it('should redact failing providers', () => {
        failure.status.should.equal(500);
        failure.body.should.not.contain('private tenant');
    });
    it('should reject oversized discovery results', () => oversized.should.equal(500));
});
