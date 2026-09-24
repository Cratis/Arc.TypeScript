```typescript
import { field } from '@cratis/fundamentals';
import { command, currentServices } from '@cratis/arc.core';

@command()
export class AssessLoan {
    @field(LoanId) loanId!: LoanId;
    @field(ApplicantId) applicant!: ApplicantId;

    // provide() takes no parameters, so it resolves its services from the execution scope.
    async provide(): Promise<CreditScore> {
        const bureau = await currentServices().resolve(CreditBureau);
        return bureau.scoreFor(this.applicant);
    }

    handle(creditScore: CreditScore): LoanAssessment {
        return new LoanAssessment(this.loanId, creditScore);
    }
}
```
