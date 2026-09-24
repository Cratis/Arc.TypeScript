```typescript
import { field } from '@cratis/fundamentals';
import { command, commandReadModel, inject, key, rejected, validation, type Outcome } from '@cratis/arc.core';

@command()
class SubmitReadyOrder {
    @field(OrderId) @key() id!: OrderId;

    @inject(commandReadModel(Order))
    handle(order: Order): Outcome<void> | void {
        if (order.status !== OrderStatus.ReadyForSubmission)
            return rejected(validation('The order is not ready for submission', ['id']));
        // Perform the application write here; reading a model does not persist a change.
    }
}
// Register Order with its owning read-model integration before running this command.
```
