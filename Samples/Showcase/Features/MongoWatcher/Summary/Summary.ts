// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { query, readModel, service } from '@cratis/arc.core';
import { mongoCollection, mongoDBWatcher, type MongoCollection, type MongoDBWatcher } from '@cratis/arc.mongodb';
import type { Observable } from 'rxjs';
import { WatcherItem } from '../WatcherItem.js';
import { WatcherNote } from '../WatcherNote.js';

/** A live summary joined over two collections with one shared database-level change stream. */
@readModel()
export class WatcherSummary {
    @field(Number) itemCount!: number;
    @field(Number) noteCount!: number;
    @field(String) latestNote!: string;

    @query({ observable: true }, service(mongoCollection(WatcherItem)), service(mongoCollection(WatcherNote)), service(mongoDBWatcher))
    static observeSummary(items: MongoCollection<WatcherItem>, notes: MongoCollection<WatcherNote>, watcher: MongoDBWatcher): Observable<WatcherSummary> {
        return watcher.observe(items).join(notes).select((allItems, allNotes) => ({
            itemCount: allItems.length,
            noteCount: allNotes.length,
            latestNote: allNotes.at(-1)?.text ?? ''
        }));
    }
}
