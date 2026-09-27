```typescript
import { ArcApplication } from '@cratis/arc.core';

export async function start(): Promise<void> {
    const builder = ArcApplication.createBuilder();
    const app = await builder.build();
    await app.run({ port: 3000 });
}
```
