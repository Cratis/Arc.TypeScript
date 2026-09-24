```typescript
import { CommandValidator, injectable, validator } from '@cratis/arc.core';

@validator(SubmitOrder)
@injectable(OrderRepository)
export class SubmitOrderValidator extends CommandValidator<SubmitOrder> {
    constructor(orders: OrderRepository) {
        super();
        this.ruleFor(command => command.id)
            .mustAsync(async (_id, command, signal) => await orders.findById(command.id, signal) !== undefined)
            .withMessage('Order does not exist.');
        this.ruleFor(command => command.id)
            .mustAsync(async (_id, command, signal) => {
                const order = await orders.findById(command.id, signal);
                return order === undefined || order.status === OrderStatus.ReadyForSubmission;
            })
            .withMessage('Only orders that are ready for submission can be submitted.');
    }
}
```
