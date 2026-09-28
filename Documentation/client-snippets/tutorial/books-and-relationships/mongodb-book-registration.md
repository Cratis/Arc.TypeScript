```typescript
// main.ts — merge these lines into the existing builder setup, before discover().
import { mongoCollection } from '@cratis/arc.mongodb';
// Import Book, BookRepository, and MongoBookRepository from ./Features/Books/.

builder.withMongoDB({
    server: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
    database: 'Library', readModels: [Author, Book]
});
builder.services.addScoped(BookRepository, async scope =>
    new MongoBookRepository(await scope.resolve(mongoCollection(Book))));
```
