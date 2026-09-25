// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import '../index.js';

should();
describe('when installing MongoDB with the deprecated builder method', () => {
    let application: Awaited<ReturnType<ReturnType<typeof ArcApplication.createBuilder>['build']>>;
    beforeEach(async () => {
        application = await ArcApplication.createBuilder({ configuration: false })
            .addMongoDB({ server: 'mongodb://localhost', database: 'Tasks', readModels: [] }).build();
    });
    afterEach(async () => { await application.dispose(); });
    it('should install a read-model resolver', () => { (application.server.options.readModelForCommandResolvers ?? []).length.should.equal(1); });
});
