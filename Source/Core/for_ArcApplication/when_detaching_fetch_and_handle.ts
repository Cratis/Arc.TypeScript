// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { given } from '../given.js';
import { ArcApplication } from '../ArcApplication.js';
import { ArcServer } from '../ArcServer.js';

should();
class an_application {
    readonly app = new ArcApplication(new ArcServer({}));
}
describe('when passing Fetch handlers without their application receiver', given(an_application, context => {
    let fetched: Response;
    let handled: Response | null;
    beforeEach(async () => {
        const fetch = context.app.fetch;
        const handle = context.app.handle;
        fetched = await fetch(new Request('http://localhost/foreign'));
        handled = await handle(new Request('http://localhost/foreign'));
    });
    afterEach(async () => { await context.app.dispose(); });
    it('should return a 404 from fetch', () => { fetched.status.should.equal(404); });
    it('should preserve fall-through from handle', () => { (handled === null).should.equal(true); });
}));
