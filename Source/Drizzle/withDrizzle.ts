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

/** An application retains ownership of its connections, pools, and migrations. */
export function withDrizzle(builder: ArcApplicationBuilder, options: DrizzleOptions): ArcApplicationBuilder {
    if (!!options.database === !!options.databaseFactory) throw new Error('Drizzle requires exactly one of database or databaseFactory');
    if (![DrizzleDialect.PostgreSQL, DrizzleDialect.MySQL,
        DrizzleDialect.SQLite].includes(options.dialect)) throw new Error('Unsupported Drizzle dialect');
    if (options.maxPageSize !== undefined && (!Number.isSafeInteger(options.maxPageSize) ||
        options.maxPageSize <= 0 || options.maxPageSize > 10000))
        throw new RangeError('maxPageSize must be between 1 and 10000');
    const registered = new Set<new () => object>();
    // Check registrations before a request opens a tenant scope; reuse one codec per type.
    const codecs = new Map<new () => object, DrizzleModelCodec<object>>();
    const commandModels = new Set<new () => object>();
    for (const { type, table } of options.readModels ?? []) {
        if (registered.has(type)) throw new Error(`Duplicate Drizzle read model: ${type.name}`);
        registered.add(type);
        const columns = getTableColumns(table);
        const codec = new DrizzleModelCodec(type, columns);
        const keys = Object.entries(columns).filter(([, column]) => column.primary);
        if (keys.length === 1 && codec.sortableFields.has(keys[0]![0])) commandModels.add(type);
        new DrizzleReadModels({}, table, type, options.maxPageSize, codec);
        codecs.set(type, codec);
    }
    builder.services.addScoped(DrizzleReadModelForCommandResolver, () => new DrizzleReadModelForCommandResolver(commandModels));
    builder.addReadModelForCommandResolver(DrizzleReadModelForCommandResolver);
    builder.services.addScoped(drizzleDatabase(), async scope => {
        const context: ExecutionContext | undefined = scope.identity;
        if (!context?.tenantId) throw new Error('A tenant is required for Drizzle access');
        const tenant = context.tenantId.toLowerCase();
        if (options.database && tenant !== 'default') throw new Error('Drizzle database is only available for the default tenant');
        const database = options.databaseFactory ? await options.databaseFactory(tenant, context) : options.database;
        if (!database) throw new Error('Drizzle tenant database resolver returned no database');
        return new DrizzleHandle(database);
    });
    for (const { type, table } of options.readModels ?? []) {
        builder.services.addScoped(drizzleReadModel(type), async scope =>
            new DrizzleReadModels((await scope.resolve(drizzleDatabase())).native, table, type, options.maxPageSize, codecs.get(type)!));
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
