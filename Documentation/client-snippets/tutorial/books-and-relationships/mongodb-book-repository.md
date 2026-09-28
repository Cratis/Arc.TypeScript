```typescript
import type { ObservableSource } from '@cratis/arc.core';
import type { MongoCollection } from '@cratis/arc.mongodb';
import type { Document, Filter } from 'mongodb';
// Features/Books/MongoBookRepository.ts — import AuthorId, Book, and BookRepository from their feature files.

export class MongoBookRepository extends BookRepository {
    constructor(private readonly collection: MongoCollection<Book>) { super(); }

    async save(book: Book): Promise<void> {
        const document = this.collection.codec.serialize(book);
        await this.collection.native.replaceOne({ _id: document._id } as Filter<Document>, document, { upsert: true });
    }

    observeForAuthor(authorId: AuthorId): ObservableSource<Book[]> {
        const field = this.collection.codec.fieldName('authorId');
        // BookId and AuthorId both use Guid; the key-field codec also encodes this author id.
        const storedId = this.collection.codec.id(authorId);
        return this.collection.observe({ [field]: storedId });
    }
}
```
