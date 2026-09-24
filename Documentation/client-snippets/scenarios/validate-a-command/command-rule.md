```typescript
import { CommandValidator, validator } from '@cratis/arc.core';

@validator(RegisterAuthor)
export class RegisterAuthorValidator extends CommandValidator<RegisterAuthor> {
    constructor() {
        super();
        this.ruleFor(command => command.name).notEmpty().maxLength(200);
    }
}
```
