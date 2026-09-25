// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it } from 'vitest';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { ArcApplication, Severity } from '@cratis/arc.core';
import '../../index.js';
import { drizzleDatabase } from '../../drizzleToken.js';
import { given } from '../../given.js';
import { TaskRecord } from '../../for_DrizzleReadModels/given/TaskRecord.js';
import { a_builder } from '../given/a_builder.js';

const shouldRejectWithCause = async (promise: Promise<unknown>, message: string): Promise<void> => {
    const error = await promise.should.be.rejected as Error & { cause: Error };
    error.cause.message.should.equal(message);
};
const identity = (tenantId?: string) => ({ tenantId, principal: undefined, allowedSeverity: Severity.Warning,
    signal: new AbortController().signal, correlationId: crypto.randomUUID() });
describe('when configuring tenant SQL access', given(a_builder, context => {
    beforeEach(() => { context.builder = ArcApplication.createBuilder(); });
    it('should reject both database sources', () => {
        (() => context.builder.withDrizzle({ dialect: 'sqlite', database: {}, databaseFactory: () => ({}) }))
            .should.throw('exactly one of database or databaseFactory');
    });
    it('should reject no database source', () => {
        (() => context.builder.withDrizzle({ dialect: 'sqlite' })).should.throw('exactly one of database or databaseFactory');
    });
    it('should reject an unsupported dialect and invalid maximum even without read models', () => {
        (() => context.builder.withDrizzle({ dialect: 'oracle' as 'sqlite', database: {} }))
            .should.throw('Unsupported Drizzle dialect');
        (() => context.builder.withDrizzle({ dialect: 'sqlite', database: {}, maxPageSize: 0 }))
            .should.throw('maxPageSize must be between 1 and 10000');
    });
    it('should reject a missing tenant', async () => {
        context.builder.withDrizzle({ dialect: 'sqlite', database: {} });
        const app = await context.builder.build();
        const scope = app.server.services.createScope(identity());
        try { await shouldRejectWithCause(scope.resolve(drizzleDatabase()), 'A tenant is required for Drizzle access'); }
        finally { await scope.dispose(); await app.dispose(); }
    });
    it('should reject a non-default tenant with a single database', async () => {
        context.builder.withDrizzle({ dialect: 'sqlite', database: {} });
        const app = await context.builder.build();
        const scope = app.server.services.createScope(identity('other'));
        try { await shouldRejectWithCause(scope.resolve(drizzleDatabase()), 'Drizzle database is only available for the default tenant'); }
        finally { await scope.dispose(); await app.dispose(); }
    });
    it('should reject a resolver that returns no database', async () => {
        context.builder.withDrizzle({ dialect: 'sqlite', databaseFactory: () => undefined as never });
        const app = await context.builder.build();
        const scope = app.server.services.createScope(identity('other'));
        try { await shouldRejectWithCause(scope.resolve(drizzleDatabase()), 'Drizzle tenant database resolver returned no database'); }
        finally { await scope.dispose(); await app.dispose(); }
    });
    it('should pass a normalized tenant to the factory', async () => {
        let resolvedTenant = '';
        context.builder.withDrizzle({ dialect: 'sqlite', databaseFactory: tenant => {
            resolvedTenant = tenant;
            return {};
        } });
        const app = await context.builder.build();
        const scope = app.server.services.createScope(identity('TENANT'));
        try { await scope.resolve(drizzleDatabase()); resolvedTenant.should.equal('tenant'); }
        finally { await scope.dispose(); await app.dispose(); }
    });
    it('should reject a missing primary key at registration', () => {
        const table = sqliteTable('no_key', { id: text('id'), title: text('title') });
        (() => context.builder.withDrizzle({ dialect: 'sqlite', database: {}, readModels: [{ type: TaskRecord, table }] }))
            .should.throw('requires a primary key');
    });
    it('should reject an undeclared table field at registration', () => {
        const table = sqliteTable('incomplete', { id: text('id').primaryKey() });
        (() => context.builder.withDrizzle({ dialect: 'sqlite', database: {}, readModels: [{ type: TaskRecord, table }] }))
            .should.throw('no column for field: title');
    });
}));
