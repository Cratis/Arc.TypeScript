```typescript
import { field } from '@cratis/fundamentals';
import { command, inject } from '@cratis/arc.core';

@command()
export class AddBook {
    @field(AuthorId) authorId!: AuthorId;
    @field(BookId) bookId!: BookId;
    @field(BookTitle) title!: BookTitle;

    @inject(BookRepository)
    handle(books: BookRepository): Promise<void> {
        return books.save({ id: this.bookId, authorId: this.authorId, title: this.title });
    }
}
```
