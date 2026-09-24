```typescript
import { field } from '@cratis/fundamentals';
import { allowAnonymous, command, inject, query, readModel, roles, service, type ObservableSource } from '@cratis/arc.core';

@roles('Librarian')                        // only a Librarian may register an author
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

    @allowAnonymous()                       // the public catalog is open to everyone
    @query({ observable: true }, service(AuthorRepository))
    static allAuthors(authors: AuthorRepository): ObservableSource<Author[]> {
        return authors.observeAll();
    }
}
```
