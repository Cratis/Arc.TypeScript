```typescript
import { ConceptAs, Guid } from '@cratis/fundamentals';
import { ConceptValidator, validator } from '@cratis/arc.core';

// Authors/AuthorId.ts
export class AuthorId extends ConceptAs<Guid> {
    static readonly valueType = Guid;

    static create(): AuthorId {
        return new AuthorId(Guid.create());
    }
}

// Authors/AuthorName.ts
export class AuthorName extends ConceptAs<string> {
    static readonly valueType = String;
}

@validator(AuthorName)
export class AuthorNameValidator extends ConceptValidator<AuthorName> {
    constructor() {
        super();
        this.ruleFor(name => name.value).notEmpty();
    }
}
```
