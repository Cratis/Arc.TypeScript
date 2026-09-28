```typescript
import { ConceptAs, Guid } from '@cratis/fundamentals';

export class AuthorId extends ConceptAs<Guid> {
    static readonly valueType = Guid;
    static create(): AuthorId { return new AuthorId(Guid.create()); }
}
```
