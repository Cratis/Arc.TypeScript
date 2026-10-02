// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '@cratis/arc.core';
import { Tasks } from './Features/Tasks/Tasks.js';
import { metadata } from './Features/generatedMetadata.js';

// The Yarn start script selects Development; appsettings.json only opts into fixture providers.
const builder = ArcApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
builder.services.addSingleton(Tasks);
await builder.discover(new URL('./Features/', import.meta.url));
export const app = await builder.build();
await app.run({ port: Number(process.env.PORT ?? 3000) });
