```typescript
import { field } from '@cratis/fundamentals';
import { command, inject, roles } from '@cratis/arc.core';

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
```
