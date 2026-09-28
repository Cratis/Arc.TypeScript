```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, key } from '@cratis/arc.core';
import { AuthorId } from '../AuthorId.js';
import { AuthorName } from '../AuthorName.js';

@eventType()
export class AuthorRegistered {
    @field(AuthorName) name: AuthorName;
    constructor(name: AuthorName = new AuthorName('')) { this.name = name; }
}

@command()
export class RegisterAuthor {
    @key() @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    handle(): AuthorRegistered { return new AuthorRegistered(this.name); }
}
```
