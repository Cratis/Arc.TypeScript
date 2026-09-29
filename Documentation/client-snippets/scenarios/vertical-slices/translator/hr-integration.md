```typescript
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { onceOnly, reactor } from '@cratis/chronicle/reactors';
import { MemberName } from '../MemberName.js';
import { RegisterMember } from '../Registration/Registration.js';

// Members/HRIntegration/HRIntegration.ts

// ─── External Event ───────────────────────────────────────────────────────────
// The inbound adapter records this integration event in Chronicle.
// Its string fields mirror the HR payload, not Library domain concepts.

/** Records the staff-creation payload received from HR. */
@eventType()
export class HRMemberCreated {
    @field(String) employeeId: string;
    @field(String) givenName: string;
    @field(String) familyName: string;
    @field(String) status: string;

    constructor(employeeId = '', givenName = '', familyName = '', status = '') {
        this.employeeId = employeeId;
        this.givenName = givenName;
        this.familyName = familyName;
        this.status = status;
    }
}

// ─── Translator Reactor ───────────────────────────────────────────────────────

@reactor()
export class MemberImportReactor {
    // Chronicle calls the method named after the event class with its first letter lowercased.
    @onceOnly()
    hRMemberCreated(event: HRMemberCreated): RegisterMember | undefined {
        // Only import active staff as library members
        if (event.status !== 'ACTIVE') {
            return undefined;
        }

        return new RegisterMember(new MemberName(event.givenName), new MemberName(event.familyName));
    }
}
```
