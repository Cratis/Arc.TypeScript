```typescript
import { field, Guid } from '@cratis/fundamentals';
import { ArcApplication, key } from '@cratis/arc.core';
import '@cratis/arc.chronicle';
import { camelCaseMongoNamingPolicy } from '@cratis/arc.mongodb';

// Users/User.ts
export class User {
    @field(Guid) @key() id!: Guid;
    @field(String) firstName!: string;
    @field(String) emailAddress!: string;
}

// main.ts
const builder = ArcApplication.createBuilder();
builder.withMongoDB({
    server: 'mongodb://localhost:27017',
    database: 'my-app',
    readModels: [User],
    namingPolicy: camelCaseMongoNamingPolicy
});
// The Chronicle client Arc creates stores a projected User in the collection this policy reads (users),
// because withMongoDB is configured. No collectionName override is needed.
builder.withChronicle({ connectionString: 'chronicle://localhost:35000', eventStore: 'my-app' });
const app = await builder.build();
await app.run();
```
