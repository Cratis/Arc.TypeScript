```typescript
import { field } from '@cratis/fundamentals';
import { query, readModel, service } from '@cratis/arc.core';
import type { BehaviorSubject } from 'rxjs';

@readModel()
export class Author {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    @query({ observable: true }, service(AuthorRepository))
    static allAuthors(authors: AuthorRepository): BehaviorSubject<Author[]> {
        return authors.observeAll();
    }
}
```
