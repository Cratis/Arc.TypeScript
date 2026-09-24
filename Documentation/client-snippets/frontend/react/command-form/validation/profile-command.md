```typescript
import { ConceptAs, field } from '@cratis/fundamentals';
import { command, CommandValidator, ConceptValidator, validator } from '@cratis/arc.core';

export class ProfileName extends ConceptAs<string> {
    static readonly valueType = String;
}

export class EmailAddress extends ConceptAs<string> {
    static readonly valueType = String;
}

@validator(EmailAddress)
export class EmailAddressValidator extends ConceptValidator<EmailAddress> {
    constructor() {
        super();
        this.ruleFor(email => email.value).notEmpty().emailAddress();
    }
}

export class ProfileDetails {
    constructor(readonly name: ProfileName, readonly email: EmailAddress) {}
}

@command()
export class UpdateProfile {
    @field(ProfileName) name!: ProfileName;
    @field(EmailAddress) email!: EmailAddress;

    handle(): ProfileDetails {
        return new ProfileDetails(this.name, this.email);
    }
}

@validator(UpdateProfile)
export class UpdateProfileValidator extends CommandValidator<UpdateProfile> {
    constructor() {
        super();
        this.ruleFor(command => command.name).notEmpty().minLength(3).maxLength(100);
    }
}
```
