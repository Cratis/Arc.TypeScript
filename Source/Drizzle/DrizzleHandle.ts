// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { DrizzleDatabase } from './DrizzleDatabase.js';
import type { DrizzleChangeNotifications } from './DrizzleChangeNotifications.js';
import type { Table } from 'drizzle-orm';

/** Scoped reference to an application-owned connection or pool; Arc never disposes the native database. */
export class DrizzleHandle<T extends DrizzleDatabase = DrizzleDatabase> {
    constructor(readonly native: T, private readonly notifications?: DrizzleChangeNotifications, private readonly tenant?: string) {}

    /** Announce writes to registered tables or read-model types. Call after a host-owned transaction commits. */
    notifyChanged(...targets: (Table | (new () => object))[]): void {
        if (!this.notifications || !this.tenant) throw new Error('Drizzle change notification requires withDrizzle');
        this.notifications.notify(this.tenant, targets);
    }
}
