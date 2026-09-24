```typescript
import { field } from '@cratis/fundamentals';
import { command, commandReadModel, inject, key, readModel } from '@cratis/arc.core';
import { eventType } from '@cratis/chronicle/events';
import { readModel as chronicleReadModel } from '@cratis/chronicle/readModels';
import { fromEvent } from '@cratis/chronicle/projections';

@eventType() class LedgerSettled { @field(Number) balance = 0; }
@readModel() @chronicleReadModel() @fromEvent(LedgerSettled)
class LedgerBalance { @field(String) id = ''; @field(Number) balance = 0; }

@command()
class SettleLedger {
    @field(String) @key() id = '';
    @inject(commandReadModel(LedgerBalance))
    handle(ledger: LedgerBalance): LedgerSettled {
        return Object.assign(new LedgerSettled(), { balance: ledger.balance });
    }
}
// Call builder.addChronicle(...) before builder.add(SettleLedger, LedgerBalance, LedgerSettled).
```
