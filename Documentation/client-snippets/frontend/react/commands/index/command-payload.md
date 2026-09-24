```typescript
import { field } from '@cratis/fundamentals';
import { command, inject } from '@cratis/arc.core';

@command()
export class OpenDebitAccount {
    @field(AccountId) accountId!: AccountId;
    @field(AccountName) name!: AccountName;
    @field(CustomerId) owner!: CustomerId;

    @inject(AccountService)
    handle(accounts: AccountService): Promise<void> {
        return accounts.open(this.accountId, this.name, this.owner);
    }
}
```
