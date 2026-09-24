```typescript
import { CommandScenario, type ScenarioCommandResult } from '@cratis/arc.testing';
import { deepStrictEqual } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AuthorRegistration, RecordAuthor, RecordAuthorValidator } from './RecordAuthor.js';

describe('when recording an author', () => {
    let scenario: CommandScenario<RecordAuthor>;
    let result: ScenarioCommandResult;
    let registered: string[][];
    let id: AuthorId;
    let name: AuthorName;

    beforeEach(async () => {
        registered = [];
        id = AuthorId.create();
        name = new AuthorName('Ada Lovelace');
        scenario = CommandScenario.for(RecordAuthor, RecordAuthorValidator);
        scenario.services.addSingleton(AuthorRegistration, {
            register: async (authorId: AuthorId, authorName: AuthorName) => {
                registered.push([authorId.toString(), authorName.value]);
            }
        });
        result = await scenario.execute({ id, name });
    });

    afterEach(async () => { await scenario.dispose(); });

    it('should succeed through the real command pipeline', () => {
        result.shouldBeSuccessful();
    });

    it('should register the author with the intended values', () => {
        deepStrictEqual(registered, [[id.toString(), name.value]]);
    });
});
```
