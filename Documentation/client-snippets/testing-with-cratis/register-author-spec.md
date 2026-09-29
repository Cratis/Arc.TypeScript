```typescript
import { ChronicleCommandScenario } from '@cratis/arc.chronicle/testing';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AuthorRegistered, RegisterAuthor } from './RegisterAuthor.js';

describe('when registering a new author', () => {
    let scenario: ChronicleCommandScenario<RegisterAuthor>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;

    beforeEach(async () => {
        scenario = ChronicleCommandScenario.for(RegisterAuthor, AuthorRegistered);
        result = await scenario.execute({ authorId: 'author-1', name: 'Jane Austen' });
    });

    afterEach(async () => { await scenario.dispose(); });

    it('should accept the command', () => {
        result.shouldBeSuccessful();
    });

    it('should record the fact', () => {
        result.shouldHaveAppendedEvent(AuthorRegistered, 'author-1', event => event.name === 'Jane Austen');
    });
});
```
