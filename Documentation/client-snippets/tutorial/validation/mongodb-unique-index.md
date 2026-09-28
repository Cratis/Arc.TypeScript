```typescript
import { Severity, type ArcApplicationBuilder } from '@cratis/arc.core';
import { mongoCollection, type MongoCollection } from '@cratis/arc.mongodb';

export async function ensureAuthorNameIndex(collection: MongoCollection<Author>): Promise<void> {
    await collection.native.createIndex(
        { [collection.codec.fieldName('name')]: 1 },
        { unique: true, name: 'unique_author_name' });
}

// Call this from start() with the already-configured builder, instead of its build/run lines.
export async function startWithAuthorIndex(builder: ArcApplicationBuilder): Promise<void> {
    const app = await builder.build();
    try {
        const scope = app.server.services.createScope({
            tenantId: 'default', correlationId: crypto.randomUUID(), principal: undefined,
            signal: new AbortController().signal, allowedSeverity: Severity.Warning
        });
        try {
            await ensureAuthorNameIndex(await scope.resolve(mongoCollection(Author)));
        } finally {
            await scope.dispose();
        }
        await app.run({ port: 3000 });
    } finally {
        await app.dispose();
    }
}
```
