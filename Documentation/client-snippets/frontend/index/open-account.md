```typescript
import { field } from '@cratis/fundamentals';
import { command, inject } from '@cratis/arc.core';

@command()
export class OpenAccount {
    @field(AccountId) id!: AccountId;
    @field(AccountHolder) owner!: AccountHolder;

    @inject(AccountRepository)
    handle(accounts: AccountRepository): Promise<void> {
        return accounts.save({ id: this.id, owner: this.owner });
    }
}
```
