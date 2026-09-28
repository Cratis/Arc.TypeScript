```typescript
import { eq } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { SQLJsDatabase } from 'drizzle-orm/sql-js';
import { field } from '@cratis/fundamentals';
import { argument, query, readModel, service, type ObservableSource } from '@cratis/arc.core';
import { DrizzleDialect, guidCodec, sqliteColumn, type DrizzleHandle, type DrizzleReadModels } from '@cratis/arc.drizzle';

export const books = sqliteTable('books', {
    id: sqliteColumn(guidCodec(DrizzleDialect.SQLite))('id').primaryKey(),
    authorId: sqliteColumn(guidCodec(DrizzleDialect.SQLite))('author_id').notNull(),
    title: text('title').notNull()
});

export class DrizzleBookRepository extends BookRepository {
    constructor(private readonly writer: DrizzleHandle<SQLJsDatabase>,
                private readonly records: DrizzleReadModels<Book>) { super(); }

    async save(book: Book): Promise<void> {
        this.writer.native.insert(books).values({ id: book.id.value, authorId: book.authorId.value,
            title: book.title.value }).run();
        this.writer.notifyChanged(books);
    }

    observeForAuthor(authorId: AuthorId): ObservableSource<Book[]> {
        return this.records.observe(eq(books.authorId, authorId.value));
    }
}

@readModel()
export class Book {
    @field(BookId) id!: BookId;
    @field(AuthorId) authorId!: AuthorId;
    @field(BookTitle) title!: BookTitle;

    @query({ observable: true }, argument('authorId', AuthorId), service(BookRepository))
    static booksForAuthor(authorId: AuthorId, repository: BookRepository): ObservableSource<Book[]> {
        return repository.observeForAuthor(authorId);
    }
}
// Register Book against books in withDrizzle({ readModels: [{ type: Book, table: books }],
// observation: DrizzleObservation.InProcess }), and register the scoped BookRepository.
```
