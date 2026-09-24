```typescript
import { field } from '@cratis/fundamentals';
import { command, commandReadModel, inject, key, readModel } from '@cratis/arc.core';
import { eventType } from '@cratis/chronicle/events';
import { readModel as chronicleReadModel } from '@cratis/chronicle/readModels';
import { fromEvent } from '@cratis/chronicle/projections';
import { ChronicleCommandScenario } from '@cratis/arc.chronicle/testing';

@eventType() class AccountOpened { @field(Number) balance = 0; }
@readModel() @chronicleReadModel() @fromEvent(AccountOpened)
class AccountBalance { @field(String) id = ''; @field(Number) balance = 0; }
@command() class CheckAccount {
    @field(String) @key() id = '';
    @inject(commandReadModel(AccountBalance))
    handle(balance: AccountBalance): number { return balance.balance; }
}

const scenario = ChronicleCommandScenario.for(CheckAccount, AccountBalance, AccountOpened);
scenario.givenReadModel(AccountBalance, 'account-1', Object.assign(new AccountBalance(), { id: 'account-1', balance: 25 }));
const result = await scenario.execute({ id: 'account-1' });
result.shouldBeSuccessful();
await scenario.dispose();
```
