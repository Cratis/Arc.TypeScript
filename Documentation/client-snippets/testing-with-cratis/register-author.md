```typescript
import { field } from '@cratis/fundamentals';
import { command, key } from '@cratis/arc.core';
import { eventType } from '@cratis/chronicle/events';

@eventType()
export class AuthorRegistered {
    @field(String) name: string;

    constructor(name = '') {
        this.name = name;
    }
}

@command()
export class RegisterAuthor {
    @field(String) @key() authorId = '';
    @field(String) name = '';

    handle(): AuthorRegistered {
        return new AuthorRegistered(this.name);
    }
}
```
