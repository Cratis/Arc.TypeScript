```typescript
import { CommandValidator, injectable, validator } from '@cratis/arc.core';

@validator(RenameAuthor)
@injectable(AuthorRepository)
export class RenameAuthorValidator extends CommandValidator<RenameAuthor> {
    constructor(authors: AuthorRepository) {
        super();
        this.ruleFor(command => command.id)
            .mustAsync(async (_id, command, signal) => await authors.findById(command.id, signal) !== undefined)
            .withMessage('Author does not exist.');
        this.ruleFor(command => command.newName)
            .mustAsync(async (newName, command, signal) => {
                const author = await authors.findById(command.id, signal);
                return author === undefined || author.name.value !== newName;
            })
            .withMessage('Choose a different name.');
    }
}
```
