```typescript
// A rejected(...) outcome stops the command with 400 before handle() runs.
async provide(): Promise<CreditScore | Outcome<never>> {
    const bureau = await currentServices().resolve(CreditBureau);
    const score = await bureau.findScore(this.applicant);
    return score ?? rejected(validation('No credit history', ['applicant']));
}

handle(creditScore: CreditScore): LoanAssessment {
    return new LoanAssessment(this.loanId, creditScore);
}
```
