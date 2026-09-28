```typescript
import type { ObservableSource } from '@cratis/arc.core';
// Features/Books/BookRepository.ts — import AuthorId and Book from their feature files.

export abstract class BookRepository {
    abstract save(book: Book): Promise<void>;
    abstract observeForAuthor(authorId: AuthorId): ObservableSource<Book[]>;
}
```
