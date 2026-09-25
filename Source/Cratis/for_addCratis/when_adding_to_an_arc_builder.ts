// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import { addCratis } from '../index.js';

should();
describe('when adding Cratis to an Arc builder', () => {
    let application: Awaited<ReturnType<ReturnType<typeof ArcApplication.createBuilder>['build']>>;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder({ configuration: false });
        addCratis(builder, { eventStore: 'Tasks', connectionString: 'chronicle://localhost:35000' });
        application = await builder.build();
    });
    afterEach(async () => { await application.dispose(); });
    it('should leave authentication unconfigured', () => { (application.server.options.authentication ?? []).length.should.equal(0); });
});
