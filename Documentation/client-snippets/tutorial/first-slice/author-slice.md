```typescript
import { field } from '@cratis/fundamentals';
import { command, inject, query, readModel, service } from '@cratis/arc.core';
import type { BehaviorSubject } from 'rxjs';

@command()
export class RegisterAuthor {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    @inject(AuthorRepository)
    handle(authors: AuthorRepository): Promise<void> {
        return authors.save({ id: this.id, name: this.name });
    }
}

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
