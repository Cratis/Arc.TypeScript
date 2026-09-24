```typescript
import { field } from '@cratis/fundamentals';
import { argument, query, readModel, service } from '@cratis/arc.core';

@readModel()
export class DebitAccount {
    @field(AccountId) id!: AccountId;
    @field(AccountName) name!: AccountName;

    @query(argument('filter', String, { optional: true }), service(DebitAccountRepository))
    static startingWith(filter: string | undefined, accounts: DebitAccountRepository): Promise<DebitAccount[]> {
        return accounts.findByNameStartingWith(filter ?? '');
    }
}
```
