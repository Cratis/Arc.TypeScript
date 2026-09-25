// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { a_fetch_application } from './given/a_fetch_application.js';
import type { FetchArcApplication } from '../FetchArcApplication.js';

describe('when serving a registered query via fetch', given(a_fetch_application, context => {
    let application: FetchArcApplication;
    let response: Response;
    beforeEach(async () => {
        application = await context.create();
        response = await application.fetch(new Request('https://example.test/api/all'));
    });
    afterEach(async () => { await application.dispose(); });
    it('should return the query data', async () => {
        (await response.json()).data.should.deep.equal(['ready']);
    });
}));
