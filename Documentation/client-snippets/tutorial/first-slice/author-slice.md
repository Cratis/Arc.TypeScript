```typescript
import { field } from '@cratis/fundamentals';
import { command, inject, query, readModel, service, type ObservableSource } from '@cratis/arc.core';

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
    static allAuthors(authors: AuthorRepository): ObservableSource<Author[]> {
        return authors.observeAll();
    }
}
```
