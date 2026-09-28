```typescript
import { ArcApplication } from '@cratis/arc.core';
import { mongoCollection, type MongoCollection } from '@cratis/arc.mongodb';
import type { ObservableSource } from '@cratis/arc.core';
import type { Document, Filter } from 'mongodb';

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
    builder.add(RegisterAuthor, RenameAuthor, Author).withMongoDB({
        server: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
        database: 'Library', readModels: [Author]
    });
    builder.services.addScoped(AuthorRepository, async scope =>
        new MongoAuthorRepository(await scope.resolve(mongoCollection(Author))));
    const app = await builder.build();
    await app.run({ port: 3000 });
}
```
