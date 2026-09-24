```typescript
import { field } from '@cratis/fundamentals';
import { query, readModel, roles, service, type ObservableSource } from '@cratis/arc.core';

@readModel()
export class Author {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    @roles('Librarian')
    @query({ observable: true }, service(AuthorRepository))
    static allAuthors(authors: AuthorRepository): ObservableSource<Author[]> {
        return authors.observeAll();
    }
}
```
