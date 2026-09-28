```typescript
import { field } from '@cratis/fundamentals';
import { command, commandReadModel, inject, key, roles } from '@cratis/arc.core';

@command()
@roles('Librarian')
export class RegisterAuthor {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    @inject(AuthorRepository)
    handle(authors: AuthorRepository): Promise<void> {
        return authors.save({ id: this.id, name: this.name });
    }
}

@command()
@roles('Librarian')
export class RenameAuthor {
    @field(AuthorId) @key() id!: AuthorId;
    @field(AuthorName) newName!: AuthorName;

    @inject(commandReadModel(Author), AuthorRepository)
    async handle(author: Author, authors: AuthorRepository): Promise<void> {
        author.name = this.newName;
        await authors.save(author);
    }
}
```
