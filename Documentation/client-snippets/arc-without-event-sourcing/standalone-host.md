```typescript
import { ArcApplication, type ObservableSource } from '@cratis/arc.core';
import { mongoCollection, type MongoCollection } from '@cratis/arc.mongodb';
import type { Document, Filter } from 'mongodb';
import { metadata } from './Features/generatedMetadata.js';

// Features/Authors/AuthorRepository.ts — import Author and its concepts here.
// Import this runtime token into main.ts, commands, queries, and validators.
export abstract class AuthorRepository {
    abstract save(author: Author): Promise<void>;
    abstract all(): Promise<Author[]>;
    abstract observeAll(): ObservableSource<Author[]>;
    abstract findById(id: AuthorId, signal?: AbortSignal): Promise<Author | undefined>;
    abstract existsByName(name: AuthorName, signal?: AbortSignal): Promise<boolean>;
}

// main.ts — import AuthorRepository from ./Features/Authors/AuthorRepository.js.
// Also import Author, AuthorId, AuthorName, RegisterAuthor, and RenameAuthor from their feature files.
class MongoAuthorRepository extends AuthorRepository {
    constructor(private readonly collection: MongoCollection<Author>) { super(); }

    async save(author: Author): Promise<void> {
        const document = this.collection.codec.serialize(author);
        await this.collection.native.replaceOne({ _id: document._id } as Filter<Document>, document, { upsert: true });
    }
    all(): Promise<Author[]> { return this.collection.find(); }
    observeAll(): ObservableSource<Author[]> { return this.collection.observe(); }
    async findById(id: AuthorId): Promise<Author | undefined> {
        return await this.collection.findById(id) ?? undefined;
    }
    async existsByName(name: AuthorName): Promise<boolean> {
        return (await this.collection.find({ [this.collection.codec.fieldName('name')]: name.value })).length > 0;
    }
}

export async function start(): Promise<void> {
    const builder = ArcApplication.createBuilder({ tenancy: { resolve: () => 'default' } });
    builder.useGeneratedMetadata(metadata);
    builder.withMongoDB({
        server: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
        database: 'Library', readModels: [Author]
    });
    builder.services.addScoped(AuthorRepository, async scope =>
        new MongoAuthorRepository(await scope.resolve(mongoCollection(Author))));
    // Use the same Features root as arc-proxygenerator's --artifacts argument.
    await builder.discover(new URL('./Features/', import.meta.url));
    const app = await builder.build();
    await app.run({ port: 3000 });
}

await start();
```
