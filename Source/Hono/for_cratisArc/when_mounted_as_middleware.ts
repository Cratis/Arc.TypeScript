// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import { cratisArc } from '../index.js';
import { given } from '../given.js';

should();
class an_arc_query {
    readonly arc = new ArcServer({ queries: [defineQuery({ name: 'Echo', schema: z.object({}), perform: () => 'ok' })] });
    readonly app = new Hono();
    constructor() {
        this.app.use('/v1/*', cratisArc(this.arc));
        this.app.get('/v1/health', c => c.text('healthy'));
    }
}
describe('when mounting Arc as Hono middleware', given(an_arc_query, context => {
    let response: Response;
    let foreign: Response;
    beforeEach(async () => {
        response = await context.app.request('/v1/api/echo');
        foreign = await context.app.request('/v1/health');
    });
    afterEach(async () => { await context.arc.dispose(); });
    it('should serve the query under the mount prefix', () => { response.status.should.equal(200); });
    it('should leave foreign paths to Hono', () => { foreign.status.should.equal(200); });
}));
