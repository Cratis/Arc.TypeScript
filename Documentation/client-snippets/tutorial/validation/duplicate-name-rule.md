```typescript
import { CommandValidator, injectable, validator } from '@cratis/arc.core';

@validator(RegisterAuthor)
@injectable(AuthorRepository)
export class RegisterAuthorValidator extends CommandValidator<RegisterAuthor> {
    constructor(authors: AuthorRepository) {
        super();
        this.ruleFor(command => command.name)
            .mustAsync(async (_name, command, signal) => !await authors.existsByName(command.name, signal))
            .withMessage('An author with that name is already registered.');
    }
}
```
