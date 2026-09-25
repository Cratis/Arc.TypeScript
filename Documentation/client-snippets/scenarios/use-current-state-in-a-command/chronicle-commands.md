```typescript
import { field } from '@cratis/fundamentals';
import { command, commandReadModel, inject, key, readModel } from '@cratis/arc.core';
import { eventType } from '@cratis/chronicle/events';
import { fromEvent } from '@cratis/chronicle/projections';

@eventType() class LedgerSettled {
    @field(Number) balance: number;
    constructor(balance: number) { this.balance = balance; }
}
@readModel() @fromEvent(LedgerSettled)
class LedgerBalance { @field(String) id = ''; @field(Number) balance = 0; }

@command()
class SettleLedger {
    @field(String) @key() id = '';
    @inject(commandReadModel(LedgerBalance))
    handle(ledger: LedgerBalance): LedgerSettled {
        return new LedgerSettled(ledger.balance);
    }
}
// Call builder.withChronicle(...) before builder.add(SettleLedger, LedgerBalance, LedgerSettled).
```
