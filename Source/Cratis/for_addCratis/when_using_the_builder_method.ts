// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import '../index.js';

should();
describe('when calling builder.addCratis', () => {
    let application: Awaited<ReturnType<ReturnType<typeof ArcApplication.createBuilder>['build']>>;
    beforeEach(async () => {
        application = await ArcApplication.createBuilder({ configuration: false })
            .addCratis({ eventStore: 'Tasks', connectionString: 'chronicle://localhost:35000' }).build();
    });
    afterEach(async () => { await application.dispose(); });
    it('should install the Chronicle extension', () => {
        (application.server.options.authentication ?? []).length.should.equal(0);
    });
});
