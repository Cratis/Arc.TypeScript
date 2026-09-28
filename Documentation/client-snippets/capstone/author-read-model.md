```typescript
import { field } from '@cratis/fundamentals';
import { query, readModel, service } from '@cratis/arc.core';
import { ChronicleReadModels } from '@cratis/arc.chronicle';
import type { Observable } from 'rxjs';
import { fromEvent } from '@cratis/chronicle/projections';
import { AuthorRegistered } from '../Registration/Registration.js';
import { AuthorId } from '../AuthorId.js';
import { AuthorName } from '../AuthorName.js';

@readModel()
@fromEvent(AuthorRegistered)
export class Author {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    @query({ observable: true }, service(ChronicleReadModels))
    static allAuthors(models: ChronicleReadModels): Observable<Author[]> {
        return models.observeAll(Author, author => author.id.toString());
    }
}
```
