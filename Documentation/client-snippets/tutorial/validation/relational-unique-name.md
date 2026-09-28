```typescript
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { DrizzleDialect, guidCodec, sqliteColumn } from '@cratis/arc.drizzle';

export const authors = sqliteTable('authors', {
    id: sqliteColumn(guidCodec(DrizzleDialect.SQLite))('id').primaryKey(),
    name: text('name').notNull().unique()
});
```
