// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcApplication } from '../ArcApplication.js';

describe('when a supplied configuration environment is Development', () => {
    let app: ArcApplication;
    beforeEach(async () => {
        app = await ArcApplication.createBuilder({ configuration: {
            file: '/nonexistent/appsettings.json', env: { DOTNET_ENVIRONMENT: 'Development' }
        } }).build();
    });
    afterEach(async () => { await app.dispose(); });
    it('should enable exception detail exposure by default without enabling discovery', () => {
        app.server.options.exposeExceptionDetails?.should.equal(true);
        should().equal(app.server.options.development, undefined);
    });
});
