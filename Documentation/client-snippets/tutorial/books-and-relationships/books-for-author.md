```typescript
import { field } from '@cratis/fundamentals';
import { argument, query, readModel, service, type ObservableSource } from '@cratis/arc.core';

@readModel()
export class Book {
    @field(BookId) id!: BookId;
    @field(AuthorId) authorId!: AuthorId;
    @field(BookTitle) title!: BookTitle;

    @query({ observable: true }, argument('authorId', AuthorId), service(BookRepository))
    static booksForAuthor(authorId: AuthorId, books: BookRepository): ObservableSource<Book[]> {
        return books.observeForAuthor(authorId);
    }
}
```
