```typescript
import { constraint, type IConstraint, type IConstraintBuilder } from '@cratis/chronicle/events';

// Members/Registration/Registration.ts (continued)
@constraint()
export class UniqueMemberName implements IConstraint {
    define(builder: IConstraintBuilder): void {
        builder.unique(unique => unique
            .on(MemberRegistered, event => event.firstName, event => event.lastName)
            .withMessage('A member with that name is already registered'));
    }
}
```
