```typescript
import { ConceptAs, Guid } from '@cratis/fundamentals';

// Features/Authors/AuthorId.ts
export class AuthorId extends ConceptAs<Guid> {
    static readonly valueType = Guid;

    static create(): AuthorId {
        return new AuthorId(Guid.create());
    }
}

// Features/Authors/AuthorName.ts — keep this declaration in its own file.
export class AuthorName extends ConceptAs<string> {
    static readonly valueType = String;
}
```
