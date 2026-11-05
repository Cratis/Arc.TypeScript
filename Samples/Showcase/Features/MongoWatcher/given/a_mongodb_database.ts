// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { MongoClient } from 'mongodb';
import { Guid } from '@cratis/fundamentals';
import { defaultMongoNamingPolicy, MongoDocumentCodec, withMongoDB } from '@cratis/arc.mongodb';
import type { ArcApplicationBuilder } from '@cratis/arc.core';
import { WatcherItem } from '../WatcherItem.js';
import { WatcherNote } from '../WatcherNote.js';

/** A MongoDB replica set for specs, from ARC_MONGO_TEST_URI. Without it the MongoDB specs are skipped. */
export const mongoTestUri = process.env.ARC_MONGO_TEST_URI;
export const describeWithMongo = mongoTestUri ? describe : describe.skip;

/** A throwaway database prefix; each tenant gets `<prefix>_<tenant>`. */
export class MongoTestDatabase {
    readonly prefix = `arc_showcase_spec_${crypto.randomUUID().replaceAll('-', '')}`;
    readonly client = new MongoClient(mongoTestUri ?? 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 5_000 });

    install = (builder: ArcApplicationBuilder): void => {
        withMongoDB(builder, { client: this.client, databaseNameResolver: tenant => `${this.prefix}_${tenant}`,
            readModels: [WatcherItem, WatcherNote] });
    };

    /** Store items directly, the way an outside writer would. */
    async insertItems(tenant: string, ...names: string[]): Promise<void> {
        const codec = new MongoDocumentCodec(WatcherItem, undefined, defaultMongoNamingPolicy);
        await this.client.db(`${this.prefix}_${tenant}`).collection('WatcherItems')
            .insertMany(names.map(name => codec.serialize(Object.assign(new WatcherItem(), { id: Guid.create(), name }))));
    }

    /** Store notes directly, the way an outside writer would. */
    async insertNotes(tenant: string, ...texts: string[]): Promise<void> {
        const codec = new MongoDocumentCodec(WatcherNote, undefined, defaultMongoNamingPolicy);
        await this.client.db(`${this.prefix}_${tenant}`).collection('WatcherNotes')
            .insertMany(texts.map(text => codec.serialize(Object.assign(new WatcherNote(), { id: Guid.create(), text }))));
    }

    async dispose(): Promise<void> {
        for (const tenant of ['default', 'acme', 'globex']) await this.client.db(`${this.prefix}_${tenant}`).dropDatabase();
        await this.client.close();
    }
}
