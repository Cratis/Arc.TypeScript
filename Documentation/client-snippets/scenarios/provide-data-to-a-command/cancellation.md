```typescript
import { field } from '@cratis/fundamentals';
import { command, currentContext, currentServices } from '@cratis/arc.core';

@command()
export class AssessLoan {
    @field(LoanId) loanId!: LoanId;
    @field(ApplicantId) applicant!: ApplicantId;

    // No token parameter: the execution context carries the request's AbortSignal.
    async provide(): Promise<CreditScore> {
        const bureau = await currentServices().resolve(CreditBureau);
        return bureau.scoreFor(this.applicant, currentContext()?.signal);
    }

    handle(creditScore: CreditScore): LoanAssessment {
        currentContext()?.signal.throwIfAborted();
        return new LoanAssessment(this.loanId, creditScore);
    }
}
```
