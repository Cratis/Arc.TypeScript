```typescript
import { CommandValidator, injectable, validator } from '@cratis/arc.core';

export abstract class ProfileDirectory {
    abstract isEmailAllowed(email: EmailAddress, signal: AbortSignal): Promise<boolean>;
}

@validator(UpdateProfile)
@injectable(ProfileDirectory)
export class UpdateProfileValidator extends CommandValidator<UpdateProfile> {
    constructor(profiles: ProfileDirectory) {
        super();
        this.ruleFor(command => command.name).notEmpty().minLength(3).maxLength(100);
        this.ruleFor(command => command.email)
            .mustAsync((_email, command, signal) => profiles.isEmailAllowed(command.email, signal))
            .withMessage('This email cannot be used for this profile.');
    }
}
```
