```typescript
import { field } from '@cratis/fundamentals';
import { query, readModel, service } from '@cratis/arc.core';
import { ChronicleReadModels } from '@cratis/arc.chronicle';
import { eventType } from '@cratis/chronicle/events';
import { fromEvent } from '@cratis/chronicle/projections';
import type { Observable } from 'rxjs';

@eventType()
export class AuthorRegistered {
    @field(AuthorName) firstName: AuthorName;
    @field(AuthorName) lastName: AuthorName;
    constructor(firstName = new AuthorName(''), lastName = new AuthorName('')) {
        this.firstName = firstName;
        this.lastName = lastName;
    }
}

@readModel()
@fromEvent(AuthorRegistered)
export class Author {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) firstName!: AuthorName;
    @field(AuthorName) lastName!: AuthorName;

    @query({ observable: true }, service(ChronicleReadModels))
    static allAuthors(models: ChronicleReadModels): Observable<Author[]> {
        return models.observeAll(Author, author => author.id.toString());
    }
}
```
