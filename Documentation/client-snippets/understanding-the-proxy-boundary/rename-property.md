```typescript
import { field } from '@cratis/fundamentals';
import { command, inject } from '@cratis/arc.core';

@command()
export class RegisterAuthor {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) fullName!: AuthorName;   // was name

    @inject(AuthorRepository)
    handle(authors: AuthorRepository): Promise<void> {
        return authors.save({ id: this.id, name: this.fullName });
    }
}
```
