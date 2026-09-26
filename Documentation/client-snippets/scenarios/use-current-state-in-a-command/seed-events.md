```typescript
import { field } from '@cratis/fundamentals';
import { command, commandReadModel, inject, key } from '@cratis/arc.core';
import { eventType } from '@cratis/chronicle/events';
import { reducer } from '@cratis/chronicle/reducers';
import { readModel } from '@cratis/chronicle/readModels';
import { ChronicleCommandScenario } from '@cratis/arc.chronicle/testing';

@eventType() class AccountOpened { @field(Number) balance = 0; }
@readModel() class AccountBalance { @field(Number) balance = 0; }
@reducer('AccountBalanceReducer', undefined, AccountBalance)
class AccountBalanceReducer {
    accountOpened(event: AccountOpened): AccountBalance { return { balance: event.balance }; }
}
@command() class CheckAccount {
    @field(String) @key() id = '';
    @inject(commandReadModel(AccountBalance))
    handle(balance: AccountBalance): number { return balance.balance; }
}

const scenario = ChronicleCommandScenario.for(CheckAccount, AccountBalance, AccountBalanceReducer, AccountOpened);
scenario.given.forEventSource('account-1').events(Object.assign(new AccountOpened(), { balance: 25 }));
const result = await scenario.execute({ id: 'account-1' });
result.shouldBeSuccessful();
await scenario.dispose();
```
