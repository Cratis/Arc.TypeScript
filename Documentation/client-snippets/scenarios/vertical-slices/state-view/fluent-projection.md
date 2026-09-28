```typescript
import { field } from '@cratis/fundamentals';
import { readModel } from '@cratis/arc.core';
import { eventType } from '@cratis/chronicle/events';
import { projection, type IProjectionBuilderFor, type IProjectionFor } from '@cratis/chronicle';

@eventType()
export class AuthorImported {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) firstName!: AuthorName;
    @field(AuthorName) lastName!: AuthorName;
}

@readModel()
export class Author {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) firstName!: AuthorName;
    @field(AuthorName) lastName!: AuthorName;
}

@projection('AuthorProjection', Author)
export class AuthorProjection implements IProjectionFor<Author> {
    define(builder: IProjectionBuilderFor<Author>): void {
        builder.autoMap().from(AuthorImported);
    }
}
```
