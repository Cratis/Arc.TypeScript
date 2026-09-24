```typescript
import { CommandValidator, injectable, validator } from '@cratis/arc.core';

// An abstract class, not an interface: the class itself is the service token.
export abstract class AuthorsCatalog {
    abstract isRegistered(name: AuthorName, signal: AbortSignal): Promise<boolean>;
}

@validator(RegisterAuthor)
@injectable(AuthorsCatalog)
export class RegisterAuthorValidator extends CommandValidator<RegisterAuthor> {
    constructor(authors: AuthorsCatalog) {
        super();
        this.ruleFor(command => command.name).notEmpty().maxLength(200);
        this.ruleFor(command => command.name)
            .mustAsync(async (_name, command, signal) => !await authors.isRegistered(command.name, signal))
            .withMessage('An author with that name is already registered.');
    }
}
```
