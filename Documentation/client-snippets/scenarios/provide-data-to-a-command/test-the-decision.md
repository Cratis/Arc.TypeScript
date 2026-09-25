```typescript
import { describe, expect, it } from 'vitest';
import { AssessLoan } from './AssessLoan.js';

describe('when assessing a loan', () => {
    it('should return the assessment', () => {
        const command = new AssessLoan();
        command.loanId = LoanId.create();
        command.applicant = ApplicantId.create();

        expect(command.handle(new CreditScore(800))).toBeInstanceOf(LoanAssessment);
    });
});
```
