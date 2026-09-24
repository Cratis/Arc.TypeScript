```typescript
import { ConceptAs, Guid } from '@cratis/fundamentals';

export class BookId extends ConceptAs<Guid> {
    static readonly valueType = Guid;

    static create(): BookId {
        return new BookId(Guid.create());
    }
}

export class BookTitle extends ConceptAs<string> {
    static readonly valueType = String;
}
```
