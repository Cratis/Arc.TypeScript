```typescript
import type { MongoCollection } from '@cratis/arc.mongodb';

export async function ensureAuthorNameIndex(collection: MongoCollection<Author>): Promise<void> {
    await collection.native.createIndex(
        { [collection.codec.fieldName('name')]: 1 },
        { unique: true, name: 'unique_author_name' });
}
```
