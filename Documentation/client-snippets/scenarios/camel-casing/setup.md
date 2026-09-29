```typescript
import { field, Guid } from '@cratis/fundamentals';
import { ArcApplication, key } from '@cratis/arc.core';
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
const app = await builder.build();
await app.run();
```
