```typescript
import { CommandValidator, injectable, validator } from '@cratis/arc.core';

@validator(RegisterCustomer)
@injectable(CustomerRepository)
export class RegisterCustomerValidator extends CommandValidator<RegisterCustomer> {
    constructor(customers: CustomerRepository) {
        super();
        this.ruleFor(command => command.id)
            .mustAsync(async (_id, command, signal) => await customers.findById(command.id, signal) === undefined)
            .withMessage('Customer is already registered.');
    }
}
```
