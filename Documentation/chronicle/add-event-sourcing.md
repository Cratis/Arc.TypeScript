---
title: Add event sourcing
description: Start a development Chronicle kernel, add the experimental Arc integration to your application, record an event from a command, and serve the projected read model from a query.
---

The notes in the application from [Create an application](../getting-started/create-an-application.md) live in memory: a restart loses them, and nothing records what happened. This guide adds [Chronicle](/chronicle/), the event-sourcing database, to that application. A command records a fact as an event, Chronicle projects the event into a read model, and a query serves the read model.

When you finish, `POST /api/authors/registration/register-author` appends an `AuthorRegistered` event to a Chronicle kernel on your machine, and `GET /api/authors/listing/all-authors` returns the `Author` read model Chronicle built from it.

:::caution[Experimental]
`@cratis/arc.chronicle` is experimental and, like every package in this repository, not published to npm. Its API may change. The [capability reference](../reference/capabilities.md#persistence-and-chronicle) lists what it covers.
:::

## Before you start

You need:

- The `my-arc-app` project from [Create an application](../getting-started/create-an-application.md), with the clone and the `arc-packages` folder next to it.
- Docker with Docker Compose.
- Port 35000 free on your machine.

You do not need MongoDB. The Chronicle development image bundles it.

## Start a development kernel

Chronicle runs as its own process, the kernel. Your application connects to it over port 35000. Create `compose.yaml` in `my-arc-app`:

```yaml title="compose.yaml"
services:
  chronicle:
    image: cratis/chronicle:latest-development
    ports:
      - "127.0.0.1:35000:35000"
```

Start it and wait until it reports healthy:

```bash
docker compose up -d
curl --insecure --silent --fail --retry 60 --retry-all-errors --retry-delay 1 https://localhost:35000/health
```

The second command prints `Healthy` once the kernel accepts connections, usually within 30 seconds. The development image generates a self-signed certificate, which is why the check passes `--insecure`. The port is published on `127.0.0.1` only, because the development image accepts well-known development credentials.

`latest-development` follows the newest development build. For repeatable runs, pin a released development tag instead, such as `cratis/chronicle:19.6.1-development`.

## Install the Chronicle packages

In the clone, pack the integration next to the other packages:

```bash
cd ../Arc.TypeScript
yarn workspace @cratis/arc.chronicle pack --out "$PWD/../arc-packages/arc.chronicle.tgz"
cd ../my-arc-app
```

Install it together with the Chronicle SDK and RxJS:

```bash
npm install ../arc-packages/arc.chronicle.tgz @cratis/chronicle@~6.14.0 rxjs@^7.8.2
```

| Package | What it gives you |
| --- | --- |
| `@cratis/arc.chronicle` | Appends the events a command returns, and resolves Chronicle read models for queries and commands |
| `@cratis/chronicle` | The Chronicle SDK for TypeScript, published on npm. Event types come from `@cratis/chronicle/events`, projection decorators from `@cratis/chronicle/projections` |
| `rxjs` | Observables, which the integration uses for live read models |

npm may report that it blocked the install script of `protobufjs`; the SDK runs without it.

You do not import `reflect-metadata`. The SDK depends on it, and every SDK module that reads decorator metadata imports it. The [Library sample's `main.ts`](https://github.com/Cratis/Arc.TypeScript/blob/main/Samples/Library/main.ts) has no such import either.

## Register Chronicle

Replace `main.ts`:

```typescript title="main.ts"
import { ArcApplication } from '@cratis/arc.core';
import '@cratis/arc.chronicle';
import { metadata } from './Features/generatedMetadata.js';
import { Notes } from './Features/Notes/Notes.js';

const builder = ArcApplication.createBuilder();
builder.useGeneratedMetadata(metadata);
builder.withChronicle({ connectionString: 'chronicle://localhost:35000', eventStore: 'MyArcApp' });
builder.services.addSingleton(Notes);
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
await app.run({ port: Number(process.env.PORT ?? 3000) });
```

Importing `@cratis/arc.chronicle` adds `withChronicle` to the builder. Call it before or after `discover`: the integration records each discovered event type and projection, including those discovered earlier, and hands them to Chronicle when it connects. The application connects when a command or query first needs Chronicle, and Chronicle creates the `MyArcApp` event store then. Events and read models go to the namespace of the request's tenant; this application resolves no tenant, so they go to the `Default` namespace.

Call `withChronicle` before `add()` for Chronicle-only artifacts: without an Arc decorator, `add()` rejects them until Chronicle is registered. `chronicle://localhost:35000` without credentials uses the SDK's development client and accepts the kernel's self-signed certificate. That fits a local kernel only. [Registration options](registration-options.md) shows how to read the connection from `appsettings.json` or environment variables, and how to pass a client you create yourself.

The notes slices keep working unchanged. A command that returns no event is not affected by Chronicle.

## Record an event from a command

Add an `Authors` feature next to `Notes`:

```text
Features/
├── Authors/
│   ├── AuthorId.ts
│   ├── AuthorName.ts
│   ├── Registration/
│   │   └── Registration.ts
│   └── Listing/
│       └── Listing.ts
└── Notes/
```

The two domain values:

```typescript title="Features/Authors/AuthorId.ts"
import { ConceptAs, Guid } from '@cratis/fundamentals';

export class AuthorId extends ConceptAs<Guid> { static readonly valueType = Guid; }
```

```typescript title="Features/Authors/AuthorName.ts"
import { ConceptAs } from '@cratis/fundamentals';

export class AuthorName extends ConceptAs<string> { static readonly valueType = String; }
```

The registration slice holds the command and the event it records:

```typescript title="Features/Authors/Registration/Registration.ts"
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, key } from '@cratis/arc.core';
import { AuthorId } from '../AuthorId.js';
import { AuthorName } from '../AuthorName.js';

@eventType()
export class AuthorRegistered {
    @field(AuthorName) name: AuthorName;
    constructor(name: AuthorName = new AuthorName('')) { this.name = name; }
}

@command()
export class RegisterAuthor {
    @key() @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    handle(): AuthorRegistered { return new AuthorRegistered(this.name); }
}
```

`handle()` does not store anything. It returns the fact, and Arc appends it after authorization, validation, and `handle()` succeed. The `@key()` field names the event source, so each author gets their own stream. The key is not a property of the event; Chronicle keeps it as the event source ID. `@eventType()` uses the class name, `AuthorRegistered`, as the stored event type. [Returning events](commands/index.md) covers returning several events, or events beside a response.

## Project a read model and query it

The listing slice declares what an author looks like to a reader, and how events build it:

```typescript title="Features/Authors/Listing/Listing.ts"
import { field } from '@cratis/fundamentals';
import { query, readModel } from '@cratis/arc.core';
import { ChronicleReadModels } from '@cratis/arc.chronicle';
import { fromEvent } from '@cratis/chronicle/projections';
import { AuthorRegistered } from '../Registration/Registration.js';
import { AuthorId } from '../AuthorId.js';
import { AuthorName } from '../AuthorName.js';

@readModel()
@fromEvent(AuthorRegistered)
export class Author {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    @query()
    static allAuthors(models: ChronicleReadModels): Promise<Author[]> {
        return models.getAll(Author);
    }
}
```

`@fromEvent(AuthorRegistered)` is a model-bound projection. Chronicle copies the event's `name` onto `Author.name`, and the event source ID becomes `id`. Chronicle runs the projection inside the kernel and stores the result. `ChronicleReadModels` reads the stored read models for the current tenant; Arc provides it once Chronicle is registered. [Read models](read-models/index.md) covers lookups by ID, live queries, and consistency.

## Regenerate and run

`handle()` and the query changed the artifacts, so regenerate the metadata:

```bash
npm run generate
```

It prints `Generated 6 changed file(s)`. If the watch loop from [Create an application](../getting-started/create-an-application.md#run-the-development-loop) is running, it has already done this. Then start the server, or let `tsx` restart it:

```bash
npm run dev
```

## Check it with curl

Register an author:

```bash
curl -X POST http://127.0.0.1:3000/api/authors/registration/register-author \
  -H 'content-type: application/json' \
  -d '{"id":"6f1b8d2a-3c4e-4f5a-9b6c-7d8e9f0a1b2c","name":"Octavia E. Butler"}'
```

The answer is HTTP 200 with `"isSuccess":true` and no `response`. Arc answers success only after Chronicle has stored the event; if the append fails, the command fails. Read the authors:

```bash
curl http://127.0.0.1:3000/api/authors/listing/all-authors
```

The answer's `data` is `[{"id":"6f1b8d2a-3c4e-4f5a-9b6c-7d8e9f0a1b2c","name":"Octavia E. Butler"}]`.

If `data` is `[]`, send the query again. Storing the event and projecting it are separate steps. The command answers after the first; the kernel runs the projection afterwards, usually within a second or two. A query sent in that gap reads the read model as it was before the event. [Wait for the projection](#wait-for-the-projection) shows how to handle that gap in an application.

To see the event itself, browse the `MyArcApp` event store in the [Workbench](/chronicle/workbench/) at <https://localhost:35000>. With the [Cratis CLI](/cli/) installed, this prints the stored events:

```bash
cratis chronicle events get --server chronicle://localhost:35000 --event-store MyArcApp -o json
```

It lists one `AuthorRegistered` event, with the author's ID as `eventSourceId` and `{"name":"Octavia E. Butler"}` as `content`. Its `correlationId` matches the one in the command's answer.

## Wait for the projection

A client that registers an author and then asks for the list can run into the gap above. Choose how to handle it by what the client needs:

- **Show what is there, and update it.** A screen that lists authors can subscribe to an observable query, which pushes a new list whenever the projection changes. [Read models](read-models/index.md) shows the query, and [Subscribe to an observable query](../queries/subscribing-to-observable-queries.md) the client side.
- **Ask again.** A script or test that needs the new author can repeat the query until it appears, with a limit on how long it tries.
- **Make the command wait**, as described next, when the caller must see its own write in the very next query.

### Make the command wait

With `completionTimeoutMs`, Arc waits after each append until Chronicle reports that its observers have processed the event, and only then answers:

```typescript title="main.ts (excerpt)"
builder.withChronicle({ connectionString: 'chronicle://localhost:35000', eventStore: 'MyArcApp', completionTimeoutMs: 10000 });
```

A query sent after the command's answer then sees the new author. Know two things before you turn it on:

- If an observer fails or the wait times out, the command answers HTTP 500 although the event is already stored. Do not retry such a command blindly.
- Chronicle currently waits for **every** observer on the event log, including projections and reactors that do not handle the appended event type. As soon as the application has a projection that `AuthorRegistered` does not feed, `RegisterAuthor` waits the full ten seconds and answers HTTP 500, even though the event was appended and projected. This is [Cratis/Chronicle#4132](https://github.com/Cratis/Chronicle/issues/4132). Until it is fixed, use the wait only in an application where every observer handles every event you append.

[Choose Chronicle read consistency](../queries/read-consistency.md) compares these options with on-demand reads of passive projections.

## Stop the kernel

```bash
docker compose down --volumes
```

This stops and removes the kernel container and the volumes the image created for its bundled MongoDB, and with them every event and read model. Without `--volumes`, those volumes stay behind unused and take up disk space. `docker compose stop` stops the kernel and keeps the data for the next `docker compose start`.

## If something goes wrong

- **The health check never prints `Healthy`.** Run `docker compose logs chronicle` to see why the kernel did not start. When a new `latest-development` build fails to start, pin the previous released development tag in `compose.yaml`.
- **A command or query that needs Chronicle does not answer.** The kernel is not running or not reachable at `localhost:35000`. The server starts without it, and the SDK keeps trying to connect, so the request waits instead of failing. It completes once the kernel is healthy. Run `docker compose ps` and the health check.
- **The server stops with `Chronicle requires eventStore and exactly one of connectionString or client`.** `withChronicle` got no event store, no connection, or both a connection string and a client. See [Registration options](registration-options.md).
- **The command answers HTTP 400 with a `constraintViolation` or `concurrencyViolation` reason.** Chronicle rejected the append, and nothing was stored. See [Concurrency](commands/concurrency.md).
- **`register-author` and `all-authors` answer HTTP 500 with `An unexpected error occurred`.** Check that event types and projections are exported beneath the discovery root. For Chronicle-only artifacts passed to `add()`, call `withChronicle` before `add()`.

## Next steps

- [Returning events](commands/index.md): return several events, or events beside a response.
- [Read models](read-models/index.md): look up a read model by ID, and serve live lists.
- [Read models in commands](read-models/injecting-into-commands.md): decide from the state projected for the command's key.
- [Testing Chronicle commands](../testing/chronicle.md): assert the events a command returns, without a kernel.
- [The Cratis package](cratis-package.md): register Arc and Chronicle with one call.
- [Explore the Library sample](../getting-started/library-sample.md): the same author slices with books, a uniqueness constraint, and a React frontend.
