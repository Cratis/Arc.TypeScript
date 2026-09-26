// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DrizzleDialect } from './DrizzleDialect.js';
import { ArcApplicationBuilder } from '@cratis/arc.core';
import type { ExecutionContext } from '@cratis/arc.core';
import { ArcApplicationBuilder as FetchArcApplicationBuilder } from '@cratis/arc.core/fetch';
import type { DrizzleOptions } from './DrizzleOptions.js';
import { DrizzleReadModels } from './DrizzleReadModels.js';
import { DrizzleHandle } from './DrizzleHandle.js';
import { drizzleDatabase, drizzleReadModel } from './drizzleToken.js';
import { DrizzleModelCodec } from './DrizzleModelCodec.js';
import { DrizzleReadModelForCommandResolver } from './DrizzleReadModelForCommandResolver.js';
import { getTableColumns } from 'drizzle-orm';
import type { Table } from 'drizzle-orm';
import { DrizzleObservation } from './DrizzleObservation.js';
import { DrizzleChangeNotifications } from './DrizzleChangeNotifications.js';
import { PostgreSQLObservationManager } from './PostgreSQLObservationManager.js';

/** An application retains ownership of its connections, pools, and migrations. */
export function withDrizzle(builder: ArcApplicationBuilder, options: DrizzleOptions): ArcApplicationBuilder {
    if (!!options.database === !!options.databaseFactory) throw new Error('Drizzle requires exactly one of database or databaseFactory');
    if (![DrizzleDialect.PostgreSQL, DrizzleDialect.MySQL,
        DrizzleDialect.SQLite].includes(options.dialect)) throw new Error('Unsupported Drizzle dialect');
    if (options.maxPageSize !== undefined && (!Number.isSafeInteger(options.maxPageSize) ||
        options.maxPageSize <= 0 || options.maxPageSize > 10000))
        throw new RangeError('maxPageSize must be between 1 and 10000');
    const postgresql = typeof options.observation === 'object' && options.observation?.mode === DrizzleObservation.PostgreSQLNotify;
    if (options.observation !== undefined && options.observation !== DrizzleObservation.InProcess && !postgresql)
        throw new Error('Unsupported Drizzle observation mode');
    if (postgresql && options.dialect !== DrizzleDialect.PostgreSQL)
        throw new Error('PostgreSQL observation requires DrizzleDialect.PostgreSQL');
    if (postgresql && typeof (options.observation as { listener?: unknown }).listener !== 'function')
        throw new Error('PostgreSQL observation requires a listener factory');
    const tables = new Map<new () => object, Table>();
    const notifications = new DrizzleChangeNotifications(tables, options.observation === DrizzleObservation.InProcess);
    const registered = new Set<new () => object>();
    // Check registrations before a request opens a tenant scope; reuse one codec per type.
    const codecs = new Map<new () => object, DrizzleModelCodec<object>>();
    const commandModels = new Set<new () => object>();
    for (const { type, table } of options.readModels ?? []) {
        if (registered.has(type)) throw new Error(`Duplicate Drizzle read model: ${type.name}`);
        registered.add(type);
        tables.set(type, table);
        const columns = getTableColumns(table);
        const codec = new DrizzleModelCodec(type, columns);
        const keys = Object.entries(columns).filter(([, column]) => column.primary);
        if (keys.length === 1 && codec.sortableFields.has(keys[0]![0])) commandModels.add(type);
        new DrizzleReadModels({}, table, type, options.maxPageSize, codec);
        codecs.set(type, codec);
    }
    builder.services.addSingleton(DrizzleChangeNotifications, () => notifications);
    if (postgresql) {
        const configuration = options.observation as import('./PostgreSQLObservationOptions.js').PostgreSQLObservationOptions;
        builder.services.addSingleton(PostgreSQLObservationManager, () => new PostgreSQLObservationManager(configuration));
    }
    builder.services.addScoped(DrizzleReadModelForCommandResolver, () => new DrizzleReadModelForCommandResolver(commandModels));
    builder.addCommandExecutionRunner((context, execute) => context.tenantId ?
        notifications.run(context.tenantId.toLowerCase(), execute) : execute());
    builder.addReadModelForCommandResolver(DrizzleReadModelForCommandResolver);
    builder.services.addScoped(drizzleDatabase(), async scope => {
        const context: ExecutionContext | undefined = scope.identity;
        if (!context?.tenantId) throw new Error('A tenant is required for Drizzle access');
        const tenant = context.tenantId.toLowerCase();
        if (options.database && tenant !== 'default') throw new Error('Drizzle database is only available for the default tenant');
        const database = options.databaseFactory ? await options.databaseFactory(tenant, context) : options.database;
        if (!database) throw new Error('Drizzle tenant database resolver returned no database');
        return new DrizzleHandle(database, notifications, tenant);
    });
    for (const { type, table } of options.readModels ?? []) {
        builder.services.addScoped(drizzleReadModel(type), async scope => {
            const database = (await scope.resolve(drizzleDatabase())).native;
            const tenant = scope.identity?.tenantId?.toLowerCase();
            return new DrizzleReadModels(database, table, type, options.maxPageSize, codecs.get(type)!,
                tenant ? { notifications, tenant, signal: scope.identity?.signal,
                    postgresql: postgresql ? await scope.resolve(PostgreSQLObservationManager) : undefined } : undefined);
        });
    }
    return builder;
}

declare module '@cratis/arc.core/fetch' {
    interface ArcBuilderExtensions {
        /** Attach Drizzle after importing @cratis/arc.drizzle. */
        withDrizzle(options: DrizzleOptions): this;
    }
}

ArcApplicationBuilder.registerExtension('drizzle', withDrizzle);
ArcApplicationBuilder.prototype.withDrizzle = function (options: DrizzleOptions) {
    return this.extend('drizzle', options);
};
FetchArcApplicationBuilder.prototype.withDrizzle = function (options: DrizzleOptions) {
    return this.extend('drizzle', options);
};
