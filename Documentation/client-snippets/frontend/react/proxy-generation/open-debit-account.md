```typescript
import { ConceptAs, field, Guid } from '@cratis/fundamentals';
import { command, inject } from '@cratis/arc.core';

export class AccountName extends ConceptAs<string> {
    static readonly valueType = String;
}

export class AccountBalance extends ConceptAs<number> {
    static readonly valueType = Number;
}

export abstract class AccountService {
    abstract open(name: AccountName, initialBalance: AccountBalance): Promise<Guid>;
}

@command()
export class OpenDebitAccount {
    @field(AccountName) name!: AccountName;
    @field(AccountBalance) initialBalance!: AccountBalance;

    @inject(AccountService)
    handle(accounts: AccountService): Promise<Guid> {
        return accounts.open(this.name, this.initialBalance);
    }
}
```
