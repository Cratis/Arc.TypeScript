```typescript
import { CommandValidator, currentServices, validator } from '@cratis/arc.core';

@validator(RegisterAuthor)
export class RegisterAuthorValidator extends CommandValidator<RegisterAuthor> {
    constructor() {
        super();
        this.ruleFor(command => command.name)
            .mustAsync(async (_name, command, signal) => {
                const authors = await currentServices().resolve(AuthorRepository);
                return !await authors.existsByName(command.name, signal);
            })
            .withMessage('An author with that name is already registered.');
    }
}
```
