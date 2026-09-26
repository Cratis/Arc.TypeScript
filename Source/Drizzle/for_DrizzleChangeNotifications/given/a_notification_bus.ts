// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleChangeNotifications } from '../../DrizzleChangeNotifications.js';

export class Task {}
export const table = sqliteTable('tasks', { id: text('id').primaryKey() });
export class a_notification_bus {
    bus = new DrizzleChangeNotifications(new Map([[Task, table]]), true);
    hits: string[] = [];
    constructor() { this.bus.listen('a', table, () => this.hits.push('a'));
        this.bus.listen('b', table, () => this.hits.push('b')); }
}
