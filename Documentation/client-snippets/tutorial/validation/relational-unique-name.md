```text
TypeScript does not support this workflow yet: EF Core's OnModelCreating override is .NET-only. With Arc's Drizzle integration, define a unique constraint on the author-name column in your application-owned SQL schema and apply the migration before writes. Arc supplies database handles, not schema migrations; see /arc/backend/typescript/sql/. The validator's pre-check is not a concurrency guarantee.
```
