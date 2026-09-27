// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '@cratis/arc.core';
import { DrizzleDialect } from '../../DrizzleDialect.js';
import { DrizzleObservation } from '../../DrizzleObservation.js';
import type { DrizzleOptions } from '../../DrizzleOptions.js';
import '../../index.js';

describe('when configuring PostgreSQL observation', () => {
    it('should reject SQLite and MySQL at registration', () => {
        const listener = () => ({ connect: async () => {}, query: async () => ({ rows: [] }),
            onNotification: () => {}, onDisconnect: () => {}, close: async () => {} });
        for (const dialect of [DrizzleDialect.SQLite, DrizzleDialect.MySQL])
            (() => ArcApplication.createBuilder().withDrizzle({ dialect, database: {},
                observation: { mode: DrizzleObservation.PostgreSQLNotify, listener } }))
                .should.throw('PostgreSQL observation requires DrizzleDialect.PostgreSQL');
    });
    it('should accept an enum-typed observation option without narrowing the public API', () => {
        const configure = (observation: DrizzleObservation): DrizzleOptions =>
            ({ dialect: DrizzleDialect.PostgreSQL, database: {}, observation });
        const options = configure(DrizzleObservation.InProcess);
        (options.observation as DrizzleObservation).should.equal(DrizzleObservation.InProcess);
    });
    it('should reject PostgreSQL mode in string form', () =>
        (() => ArcApplication.createBuilder().withDrizzle({ dialect: DrizzleDialect.PostgreSQL, database: {},
            observation: DrizzleObservation.PostgreSQLNotify }))
            .should.throw('Unsupported Drizzle observation mode'));
});
