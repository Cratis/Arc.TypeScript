// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcApplication } from '../ArcApplication.js';

describe('when starting with a configured Node hosting URL', () => {
    let app: ArcApplication;
    beforeEach(async () => {
        app = await ArcApplication.createBuilder({ configuration: false,
            hosting: { applicationUrl: 'http://127.0.0.1:0/' } }).build();
        await app.start();
    });
    afterEach(async () => { await app.dispose(); });
    it('should start and stop the listener', () => { should().equal(app.server.services.disposed, false); });
});
