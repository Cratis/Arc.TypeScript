```typescript
import { ConceptValidator, validator } from '@cratis/arc.core';

@validator(AuthorName)
export class AuthorNameValidator extends ConceptValidator<AuthorName> {
    constructor() {
        super();
        this.ruleFor(name => name.value).notEmpty().withMessage('An author needs a name.');
    }
}
```
