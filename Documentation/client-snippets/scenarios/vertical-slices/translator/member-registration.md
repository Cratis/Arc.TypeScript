```typescript
import { field } from '@cratis/fundamentals';
import { command, tuple } from '@cratis/arc.core';
import { eventSourceIdResponse } from '@cratis/arc.chronicle';
import { eventType } from '@cratis/chronicle/events';

// Members/Registration/Registration.ts

/** Records a member's registration in the Library. */
@eventType()
export class MemberRegistered {
    @field(MemberName) firstName: MemberName;
    @field(MemberName) lastName: MemberName;

    constructor(firstName = new MemberName(''), lastName = new MemberName('')) {
        this.firstName = firstName;
        this.lastName = lastName;
    }
}

@command()
export class RegisterMember {
    @field(MemberName) firstName: MemberName;
    @field(MemberName) lastName: MemberName;

    constructor(firstName = new MemberName(''), lastName = new MemberName('')) {
        this.firstName = firstName;
        this.lastName = lastName;
    }

    provide(): MemberId {
        return MemberId.create();
    }

    handle(memberId: MemberId) {
        return tuple(
            eventSourceIdResponse(memberId.value.toString()),
            new MemberRegistered(this.firstName, this.lastName));
    }
}
```
