```typescript
import { ArcApplication, currentServices, type IdentityDetailsProvider } from '@cratis/arc.core';
import { z } from 'zod';

const libraryIdentity = z.object({ memberId: z.string(), role: z.string(), displayName: z.string() });

const identityDetails: IdentityDetailsProvider = {
    schema: libraryIdentity,
    provide: async principal => {
        // Look the user up in your own data, keyed by the principal's id.
        const members = await currentServices().resolve(MemberRepository);
        const member = await members.bySubject(principal.id);
        if (!member) return undefined;   // /.cratis/me answers 403

        return { memberId: member.id, role: member.role, displayName: member.name };
    }
};

const builder = ArcApplication.createBuilder({ identityDetails });
builder.services.addScoped(MemberRepository, MongoMemberRepository);
```
