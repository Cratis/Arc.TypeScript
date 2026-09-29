```typescript
import { ConceptAs, Guid } from '@cratis/fundamentals';
import { ConceptValidator, validator } from '@cratis/arc.core';

// Members/MemberId.ts
export class MemberId extends ConceptAs<Guid> {
    static readonly valueType = Guid;

    static create(): MemberId {
        return new MemberId(Guid.create());
    }
}

// Members/MemberName.ts
export class MemberName extends ConceptAs<string> {
    static readonly valueType = String;
}

@validator(MemberName)
export class MemberNameValidator extends ConceptValidator<MemberName> {
    constructor() {
        super();
        this.ruleFor(name => name.value).notEmpty();
    }
}
```
