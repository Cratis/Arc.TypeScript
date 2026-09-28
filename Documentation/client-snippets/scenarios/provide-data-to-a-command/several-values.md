```typescript
// One typed object keeps RiskBand as its enum; provide() can also return tuple(score, band) for provided(...) handle parameters.
async provide(): Promise<CreditProfile> {
    const bureau = await currentServices().resolve(CreditBureau);
    const risk = await currentServices().resolve(RiskModel);
    return { score: await bureau.scoreFor(this.applicant), band: await risk.bandFor(this.applicant) };
}

handle({ score, band }: CreditProfile): LoanAssessment {
    return new LoanAssessment(this.loanId, score, band);
}
```
