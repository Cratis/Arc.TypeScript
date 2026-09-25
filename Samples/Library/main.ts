// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import express from 'express';
import { ArcApplication } from '@cratis/arc.core';
import { cratisArc } from '@cratis/arc.express';
import '@cratis/arc.mongodb';
import '@cratis/arc.chronicle';
import { ChronicleReadModels } from '@cratis/arc.chronicle';
import { mongoCollection } from '@cratis/arc.mongodb';
import { Authors } from './Features/Authors/Authors.js';
import { Author } from './Features/Authors/Listing/Listing.js';
import { Books } from './Features/Books/Books.js';
import { Book } from './Features/Books/Listing/Listing.js';
import { metadata } from './Features/generatedMetadata.js';

const mongoUrl = process.env.MONGODB_URL;
const chronicleUrl = process.env.CHRONICLE_URL;
if (mongoUrl && chronicleUrl) throw new Error('Select either MONGODB_URL or CHRONICLE_URL');
const builder = ArcApplication.createBuilder({ development: true, nativePrincipal: true,
    resolveTenant: () => 'Default', allowedOrigins: ['http://127.0.0.1:5173'] });
builder.useGeneratedMetadata(metadata);
if (chronicleUrl) {
    builder.withChronicle({ connectionString: chronicleUrl, eventStore: 'Library' });
    builder.services.addScoped(Authors, async scope => new Authors(undefined, await scope.resolve(ChronicleReadModels), Author));
    builder.services.addScoped(Books, async scope => new Books(undefined, await scope.resolve(ChronicleReadModels), Book));
} else if (mongoUrl) {
    builder.withMongoDB({ server: mongoUrl, database: 'Library', readModels: [Author, Book] });
    builder.services.addScoped(Authors, async scope => new Authors(await scope.resolve(mongoCollection(Author))));
    builder.services.addScoped(Books, async scope => new Books(await scope.resolve(mongoCollection(Book))));
} else {
    builder.services.addSingleton(Authors, () => new Authors());
    builder.services.addSingleton(Books, () => new Books());
}
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
