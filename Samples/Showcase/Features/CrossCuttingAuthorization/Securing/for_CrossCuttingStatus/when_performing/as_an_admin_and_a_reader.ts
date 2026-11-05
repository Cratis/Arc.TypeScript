// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_secured_status } from '../given/a_secured_status.js';

describe('when reading the secured status', given(a_secured_status, context => {
    let asReader: Awaited<ReturnType<typeof context.scenario.perform>>;
    let asAdmin: Awaited<ReturnType<typeof context.scenario.perform>>;
    beforeAll(async () => {
        context.scenario.withContext({ principal: { id: 'grace', roles: ['Reader'], isAuthenticated: true } });
        asReader = await context.scenario.perform({});
        context.scenario.withContext({ principal: { id: 'ada', roles: ['Admin'], isAuthenticated: true } });
        asAdmin = await context.scenario.perform({});
    });
    afterAll(async () => { await context.scenario.dispose(); });
    it('should deny a reader', () => { asReader.isAuthorized.should.equal(false); });
    it('should show an admin how many actions ran', () => { asAdmin.data?.runs.should.equal(1); });
}));
