// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import express from 'express';
import { ArcApplication } from '@cratis/arc.core';
import { cratisArc } from '@cratis/arc.express';
import { withChronicle } from '@cratis/arc.chronicle';
import { metadata } from './Features/generatedMetadata.js';

const builder = ArcApplication.createBuilder({ development: true, nativePrincipal: true,
    resolveTenant: () => 'Default', allowedOrigins: ['http://127.0.0.1:5173'] });
builder.useGeneratedMetadata(metadata);
withChronicle(builder, process.env.CHRONICLE_URL ? { connectionString: process.env.CHRONICLE_URL } : {});
await builder.discover(new URL('./Features/', import.meta.url));
const application = await builder.build();
const host = express();
// Demo-only trusted principal: never accept a role from an HTTP header.
const demoIdentity = () => ({ principal: { id: 'demo-librarian', roles: ['Librarian'], isAuthenticated: true } });
const arc = cratisArc(application, demoIdentity);
host.use(arc);
const port = Number(process.env.PORT ?? 3000);
const listener = host.listen(port, '127.0.0.1', () => console.log(`Library listening on http://127.0.0.1:${port}`));
const closeWebSockets = arc.injectWebSocket(listener, demoIdentity);
const stop = async () => {
    await closeWebSockets();
    await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
    await application.dispose();
};
process.once('SIGINT', () => { void stop().catch(error => { console.error(error); process.exitCode = 1; }); });
process.once('SIGTERM', () => { void stop().catch(error => { console.error(error); process.exitCode = 1; }); });
