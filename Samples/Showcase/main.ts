// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { MongoClient } from 'mongodb';
import { ArcApplication } from '@cratis/arc.core';
import { cratisArc } from '@cratis/arc.express';
import { withMongoDB } from '@cratis/arc.mongodb';
import { principalFromCookies } from './Features/Authentication/DemoUsers.js';
import { signInRoutes, tenantFromCookies } from './Features/Authentication/SignIn/SignIn.js';
import { ChangeStreamStore } from './Features/ChangeStream/ChangeStreamStore.js';
import { ObservableCollectionStore } from './Features/ObservableCollection/ObservableCollectionStore.js';
import { ObservableCollectionWithGuidStore } from './Features/ObservableCollectionWithGuid/ObservableCollectionWithGuidStore.js';
import { SecuredActions } from './Features/CrossCuttingAuthorization/SecuredActions.js';
import { LiveFeedStore } from './Features/LiveFeed/LiveFeedStore.js';
import { WatcherItem } from './Features/MongoWatcher/WatcherItem.js';
import { WatcherNote } from './Features/MongoWatcher/WatcherNote.js';
import { ShowcaseCatalog } from './Features/QueryShowcase/ShowcaseCatalog.js';
import { TickerClock } from './Features/Ticker/TickerClock.js';
import { metadata } from './Features/generatedMetadata.js';

const port = Number(process.env.PORT ?? 3002);
const mongoUrl = process.env.MONGODB_URL ?? `mongodb://127.0.0.1:${process.env.MONGODB_PORT ?? 27017}/?replicaSet=rs0&directConnection=true`;
const origins = ['5174', String(port)].flatMap(webPort => [`http://localhost:${webPort}`, `http://127.0.0.1:${webPort}`]);

// The tenant comes from the cookie the toolbar sets; only known tenants can reach a database name.
const builder = ArcApplication.createBuilder({ development: true, nativePrincipal: true,
    tenancy: { resolve: request => tenantFromCookies(request.headers.get('cookie') ?? undefined) },
    query: { allowedOrigins: origins } });
builder.useGeneratedMetadata(metadata);
builder.services.addSingleton(TickerClock);
builder.services.addSingleton(LiveFeedStore);
builder.services.addSingleton(ShowcaseCatalog);
builder.services.addSingleton(SecuredActions);
builder.services.addSingleton(ObservableCollectionStore);
builder.services.addSingleton(ObservableCollectionWithGuidStore);
builder.services.addSingleton(ChangeStreamStore);

// MongoDB connects lazily, so every page except the MongoDB one works without a server.
const mongo = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 3_000 });
withMongoDB(builder, { client: mongo, databaseNameResolver: tenant => `arc_showcase_${tenant}`, readModels: [WatcherItem, WatcherNote] });

await builder.discover(new URL('./Features/', import.meta.url));
const application = await builder.build();

const host = express();
// Demo-only identity: the user is a cookie naming a synthetic user, never a credential.
const identity = (request: { headers: { cookie?: string } }) => ({ principal: principalFromCookies(request.headers.cookie) });
const arc = cratisArc(application, identity);
host.use('/showcase', signInRoutes());
host.use(arc);
const web = [new URL('./Web/dist/', import.meta.url), new URL('../Web/dist/', import.meta.url)]
    .map(url => fileURLToPath(url)).find(path => existsSync(path));
if (web) host.use(express.static(web));

const listener = host.listen(port, '127.0.0.1', () => console.log(`Showcase listening on http://127.0.0.1:${port}${web ? '' : ' (API only: run ./run.sh to build the web app)'}`));
const closeWebSockets = arc.injectWebSocket(listener, identity);
const stop = async () => {
    await closeWebSockets();
    await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
    await application.dispose();
    await mongo.close();
};
process.once('SIGINT', () => { void stop().catch(error => { console.error(error); process.exitCode = 1; }); });
process.once('SIGTERM', () => { void stop().catch(error => { console.error(error); process.exitCode = 1; }); });
