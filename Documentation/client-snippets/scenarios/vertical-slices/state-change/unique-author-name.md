```typescript
import { constraint, type IConstraint, type IConstraintBuilder } from '@cratis/chronicle/events';

// Authors/Registration/Registration.ts (continued)
@constraint()
export class UniqueAuthorName implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(unique => unique
            .on(AuthorRegistered, event => event.firstName, event => event.lastName)
            .withMessage('An author with that name is already registered'));
    }
}
```
