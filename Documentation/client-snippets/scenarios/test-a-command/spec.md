```typescript
import { CommandScenario, type ScenarioCommandResult } from '@cratis/arc.testing';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AuthorRegistration, RecordAuthor, RecordAuthorValidator } from './RecordAuthor.js';

describe('when recording an author', () => {
    let scenario: CommandScenario<RecordAuthor>;
    let result: ScenarioCommandResult;

    beforeEach(async () => {
        scenario = CommandScenario.for(RecordAuthor, RecordAuthorValidator);
        scenario.services.addSingleton(AuthorRegistration, {
            register: async (_id: AuthorId, _name: AuthorName) => {}
        });
        result = await scenario.execute({ id: AuthorId.create(), name: new AuthorName('Ada Lovelace') });
    });

    afterEach(async () => { await scenario.dispose(); });

    it('should succeed through the real command pipeline', () => {
        result.shouldBeSuccessful();
    });
});
```
