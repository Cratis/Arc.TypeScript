// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleChangeNotifications } from '../../../DrizzleChangeNotifications.js';
import { DrizzleObservable } from '../../../DrizzleObservable.js';
import { DrizzleObservationSession } from '../../../DrizzleObservationSession.js';

class Item {}
const table = sqliteTable('items', { id: text('id').primaryKey() });
export function deferred() {
    let resolve!: (value: number) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<number>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
export async function flush(): Promise<void> {
    for (let index = 0; index < 6; index++) await new Promise<void>(resolve => setImmediate(resolve));
}
export class a_gated_observation {
    bus = new DrizzleChangeNotifications(new Map([[Item, table]]), true);
    reads = 0;
    observation?: DrizzleObservable<number>;
    open(read: () => Promise<number>): DrizzleObservable<number> {
        return this.observation = new DrizzleObservable<number>(closed => new DrizzleObservationSession(
            () => { this.reads++; return read(); }, notify => this.bus.listen('tenant', table, notify), undefined, closed), () => {});
    }
    notify(): void { this.bus.notify('tenant', [Item]); }
    close(): void { this.observation?.close(); }
    get listeners(): number { return this.bus.listenerCount('tenant'); }
}
