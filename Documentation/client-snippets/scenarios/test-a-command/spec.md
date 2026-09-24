```typescript
import { randomUUID } from 'node:crypto';
import { ArcApplication, Severity, type CommandResult } from '@cratis/arc.core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthorRegistration, RecordAuthor, RecordAuthorValidator } from './RecordAuthor.js';

describe('when recording an author', () => {
    const id = AuthorId.create();
    const name = new AuthorName('Ada Lovelace');
    let registered: string[][];
    let application: ArcApplication;
    let result: CommandResult;

    beforeEach(async () => {
        registered = [];
        const builder = ArcApplication.createBuilder();
        builder.services.addSingleton(AuthorRegistration, () => ({
            register: async (authorId: AuthorId, authorName: AuthorName) => {
                registered.push([authorId.toString(), authorName.value]);
            }
        }));
        builder.add(RecordAuthor, RecordAuthorValidator);
        application = await builder.build();

        result = await application.server.execute(Object.assign(new RecordAuthor(), { id, name }), {
            correlationId: randomUUID(), principal: undefined, tenantId: undefined,
            signal: AbortSignal.timeout(5_000), allowedSeverity: Severity.Warning
        });
    });

    afterEach(() => application.dispose());

    it('should succeed', () => expect(result.isSuccess).toBe(true));
    it('should register the author', () => expect(registered).toEqual([[id.toString(), name.value]]));
});
```
