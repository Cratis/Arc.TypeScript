```typescript
// tuple(...) supports several values; keep RiskBand typed here because provided(String) infers boxed String.
async provide(): Promise<CreditProfile> {
    const bureau = await currentServices().resolve(CreditBureau);
    const risk = await currentServices().resolve(RiskModel);
    return { score: await bureau.scoreFor(this.applicant), band: await risk.bandFor(this.applicant) };
}

handle({ score, band }: CreditProfile): LoanAssessment {
    return new LoanAssessment(this.loanId, score, band);
}
```
