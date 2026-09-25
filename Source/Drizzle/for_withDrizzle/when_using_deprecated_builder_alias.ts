// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcApplication } from '@cratis/arc.core';
import '../index.js';

should();
describe('when installing Drizzle with the deprecated builder method', () => {
    let registrations: number;
    beforeEach(() => {
        const builder = ArcApplication.createBuilder({ configuration: false });
        builder.addDrizzle({ dialect: 'sqlite', database: {} });
        registrations = builder.services.registrations.length;
    });
    it('should install the database handle registration', () => { registrations.should.equal(1); });
});
