```typescript
import { field } from '@cratis/fundamentals';
import { command, commandReadModel, inject, key } from '@cratis/arc.core';

@command()
class RenameKnownAuthor {
    @field(AuthorId) @key() id!: AuthorId;
    @field(AuthorName) newName!: AuthorName;

    @inject(commandReadModel(Author), AuthorRepository)
    async handle(author: Author, authors: AuthorRepository): Promise<void> {
        author.name = this.newName;
        await authors.save(author);
    }
}
// Configure Author as a MongoDB-owned read model; Arc will look it up by the declared key.
```
