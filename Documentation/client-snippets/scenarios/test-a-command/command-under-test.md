```typescript
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, inject, validator } from '@cratis/arc.core';

export abstract class AuthorRegistration {
    abstract register(id: AuthorId, name: AuthorName): Promise<void>;
}

@command()
export class RecordAuthor {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    @inject(AuthorRegistration)
    handle(registration: AuthorRegistration): Promise<void> {
        return registration.register(this.id, this.name);
    }
}

@validator(RecordAuthor)
export class RecordAuthorValidator extends CommandValidator<RecordAuthor> {
    constructor() {
        super();
        this.ruleFor(command => command.name).notEmpty();
    }
}
```
