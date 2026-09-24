// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import express from 'express';
import { ArcApplication } from '@cratis/arc.core';
import { mountExpress, mountExpressWebSockets } from '@cratis/arc.express';
import { mongoCollection } from '@cratis/arc.mongodb';
import { Authors } from './Features/Authors/Authors.js';
import { Author } from './Features/Authors/Listing/Author.js';
import { Books } from './Features/Books/Books.js';
import { Book } from './Features/Books/Listing/Book.js';
import { metadata } from './Features/generatedMetadata.js';

const mongoUrl = process.env.MONGODB_URL;
const builder = ArcApplication.createBuilder({ development: true, nativePrincipal: true,
    allowedOrigins: ['http://127.0.0.1:5173'] });
builder.useGeneratedMetadata(metadata);
if (mongoUrl) {
    builder.addMongoDB({ server: mongoUrl, database: 'Library', readModels: [Author, Book] });
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
mountExpress(host, application, demoIdentity);
const port = Number(process.env.PORT ?? 3000);
const listener = host.listen(port, '127.0.0.1', () => console.log(`Library listening on http://127.0.0.1:${port}`));
const closeWebSockets = mountExpressWebSockets(listener, application, demoIdentity);
const stop = async () => {
    await closeWebSockets();
    await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
    await application.dispose();
};
process.once('SIGINT', () => { void stop().catch(error => { console.error(error); process.exitCode = 1; }); });
process.once('SIGTERM', () => { void stop().catch(error => { console.error(error); process.exitCode = 1; }); });
