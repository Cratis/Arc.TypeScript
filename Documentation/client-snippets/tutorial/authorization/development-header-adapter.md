```typescript
import { ArcApplication, microsoftIdentityPlatform } from '@cratis/arc.core';

const development = process.env.NODE_ENV === 'development';
const builder = ArcApplication.createBuilder({
    development,
    authentication: development ? [microsoftIdentityPlatform()] : []
});
```
