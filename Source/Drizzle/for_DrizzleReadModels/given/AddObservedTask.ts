// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { SQLJsDatabase } from 'drizzle-orm/sql-js';
import { field, Guid } from '@cratis/fundamentals';
import { command, inject, key } from '@cratis/arc.core';
import { drizzleDatabase } from '../../drizzleToken.js';
import type { DrizzleHandle } from '../../DrizzleHandle.js';
import { taskTable } from './a_sqlite_database.js';

/** HTTP fixture uses the same registered table object for writes and reads. */
@command()
export class AddObservedTask {
    @field(Guid) @key() id!: Guid;
    @field(String) title!: string;

    @inject(drizzleDatabase<SQLJsDatabase>())
    handle(database: DrizzleHandle<SQLJsDatabase>): void {
        database.native.insert(taskTable).values({ id: this.id, title: this.title }).run();
        database.notifyChanged(taskTable);
    }
}
