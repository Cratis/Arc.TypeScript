```typescript
import { field } from '@cratis/fundamentals';
import { readModel } from '@cratis/arc.core';
import { eventType } from '@cratis/chronicle/events';
import { IProjectionBuilderFor, IProjectionFor, projection } from '@cratis/chronicle';

@eventType()
class AuthorImported {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) firstName!: AuthorName;
    @field(AuthorName) lastName!: AuthorName;
}

@readModel()
class Author {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) firstName!: AuthorName;
    @field(AuthorName) lastName!: AuthorName;
}

@projection()
class AuthorProjection implements IProjectionFor<Author> {
    define(builder: IProjectionBuilderFor<Author>): void {
        builder.autoMap().from(AuthorImported);
    }
}
```
