```typescript
import { ChronicleCommandScenario } from '@cratis/arc.chronicle/testing';
import { strictEqual } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AuthorName } from '../../../AuthorName.js';
import { AuthorRegistered, RegisterAuthor, RegisterAuthorValidator } from '../../Registration.js';

// Authors/Registration/for_RegisterAuthor/when_registering/and_author_does_not_exist.ts
describe('when registering an author that does not exist', () => {
    let scenario: ChronicleCommandScenario<RegisterAuthor>;

    beforeEach(() => {
        scenario = ChronicleCommandScenario.for(RegisterAuthor, RegisterAuthorValidator, AuthorRegistered);
    });

    afterEach(async () => { await scenario.dispose(); });

    it('should record the names under the returned identity', async () => {
        const result = await scenario.execute({
            firstName: new AuthorName('J.R.R.'),
            lastName: new AuthorName('Tolkien')
        });

        result.shouldBeSuccessful();
        strictEqual(result.appendedEvents.length, 1);
        result.shouldHaveAppendedEvent(AuthorRegistered, String(result.response),
            event => event.firstName.value === 'J.R.R.' && event.lastName.value === 'Tolkien');
    });
});
```
