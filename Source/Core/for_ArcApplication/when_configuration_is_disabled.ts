// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcApplication } from '../ArcApplication.js';

should();
describe('when configuration is disabled', () => {
    let application: ArcApplication;
    beforeEach(async () => { application = await ArcApplication.createBuilder({ configuration: false }).build(); });
    afterEach(async () => { await application.dispose(); });
    it('should start without reading Cratis settings', () => {
        (application.server.options.generatedApis?.routePrefix ?? 'api').should.equal('api');
    });
});
