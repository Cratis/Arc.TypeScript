// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { a_fetch_application } from './given/a_fetch_application.js';
import type { FetchArcApplication } from '../FetchArcApplication.js';

describe('when serving a registered command via fetch', given(a_fetch_application, context => {
    let application: FetchArcApplication;
    let response: Response;
    beforeEach(async () => {
        application = await context.create();
        response = await application.fetch(new Request('https://example.test/api/submit', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
        }));
    });
    afterEach(async () => { await application.dispose(); });
    it('should return the command result', async () => {
        (await response.json()).response.should.equal('accepted');
    });
}));
