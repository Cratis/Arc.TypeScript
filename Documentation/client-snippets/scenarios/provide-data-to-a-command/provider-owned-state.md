```typescript
import { field } from '@cratis/fundamentals';
import { command, commandReadModel, inject, key, readModel } from '@cratis/arc.core';

@readModel()
class LoanState { @field(String) id = ''; @field(Number) score = 0; }

@command()
class AssessFromCurrentState {
    @field(String) @key() id = '';

    @inject(commandReadModel(LoanState))
    provide(state: LoanState): number { return state.score; }

    handle(score: number): number { return score; }
}
// Register LoanState with the owning Chronicle or MongoDB integration before executing.
```
