```typescript
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, tuple, validator } from '@cratis/arc.core';
import { eventSourceIdResponse } from '@cratis/arc.chronicle';
import { eventType } from '@cratis/chronicle/events';

// Authors/Registration/Registration.ts

/** Records an author's registration with their first and last names. */
@eventType()
export class AuthorRegistered {
    @field(AuthorName) firstName: AuthorName;
    @field(AuthorName) lastName: AuthorName;

    constructor(firstName = new AuthorName(''), lastName = new AuthorName('')) {
        this.firstName = firstName;
        this.lastName = lastName;
    }
}

@command()
export class RegisterAuthor {
    @field(AuthorName) firstName!: AuthorName;
    @field(AuthorName) lastName!: AuthorName;

    provide(): AuthorId {
        return AuthorId.create();
    }

    handle(authorId: AuthorId) {
        return tuple(
            eventSourceIdResponse(authorId.value.toString()),
            new AuthorRegistered(this.firstName, this.lastName));
    }
}

@validator(RegisterAuthor)
export class RegisterAuthorValidator extends CommandValidator<RegisterAuthor> {
    constructor() {
        super();
        this.ruleFor(command => command.firstName).notEmpty().withMessage('First name is required');
        this.ruleFor(command => command.lastName).notEmpty().withMessage('Last name is required');
    }
}
```
