---
title: Compliance
description: What the experimental Chronicle integration does for personal data, subjects, and audit exclusion in TypeScript, and which parts of Arc on .NET's compliance support it does not have.
---

Events are immutable, yet a person can ask for their personal data to be erased. Chronicle resolves that tension by keying personal data to a **subject** and managing encryption keys per subject; destroying the key makes the data unreadable while the events stay. The [Chronicle compliance guide](/chronicle/compliance/) explains that side.

An Arc application meets compliance at two points: when a command appends events, and when a query serves the read models built from them. Chronicle (the kernel, or the SDK for reducer read models) releases read models on Chronicle reads. At its query edge, Arc releases protected models decoded into their exact read-model class from a direct collection read. It also releases raw MongoDB documents that you have explicitly typed as a protected read model.

## What the integration does

| Concern | In Arc for TypeScript |
| --- | --- |
| Record the subject on appended events | Supported. `getSubject()`, a `@subject()` field, `@eventSubject(...)`, or a routed event's `subject`, falling back to the event source ID. See [Subject](commands/subject.md). |
| Keep command values out of the causation chain | Supported. `@notAudited()`, the SDK's `@pii()` on a command field or class, and secret-looking field names. See [Causation and auditing](commands/causation.md#keep-a-value-out). |
| Mark event or read-model data as personal | Done with the SDK's `@pii()` from `@cratis/chronicle/compliance`. Arc passes your event classes to the SDK unchanged. |
| Release encrypted values when a query serves a read model | Kernel reads through Chronicle already return plaintext. Arc releases a protected Chronicle read model read directly from its materialized MongoDB collection, including items in snapshots, arrays, pages, and observable emissions. This covers decoded instances and raw `MongoReadModels` documents typed with `readModel`. |
| Release encrypted values in a command's read model | The Chronicle kernel releases read models before `commandReadModel(Type)` or a Chronicle validator read-model lookup returns them; null remains null. |
| Erase a subject's key | Not part of Arc. Use Chronicle's own tooling or the SDK's PII manager. |

## Where release happens

Mark the **read-model property** `@pii()` as well as the event property when projected personal data must be encrypted at rest. Marking only the event protects the event log but leaves the projected read-model field in plaintext.

Chronicle releases values on reads through Chronicle, including `ChronicleReadModels` snapshots, observations, watches, and command injection. Arc does not release those instances again. The exception is a reducer model whose protection sits only in nested values or `@encrypted()` fields: the TypeScript SDK does not release those, so Arc does not trust them. Returned directly, in an array or in a query page, Arc releases them at the query edge; nested inside another shape, they fail the query. The kernel releases projection watch changes, removals included, but the SDK does not release a removed reducer change: for a protected reducer model, `ChronicleReadModels` replaces a removed change's model with an empty instance of the type rather than serve that unreleased payload. Instances obtained by calling the SDK directly through `ChronicleReadModels.getStore()`, or clones of released instances, may receive an extra, harmless release at the Arc query edge.

### Release at the Arc query edge

Arc registers a scoped interceptor for Chronicle read-model classes with compliance or `@encrypted()` security metadata anywhere in their schema, including nested objects and array items. When a query returns an instance decoded **into the exact read-model class** from the materialized MongoDB collection (for example, through `@cratis/arc.mongodb`'s `MongoCollection`), Arc calls `store.readModels.release(Type, instance)` on the tenant store before wire encoding, for snapshots and observable deliveries. A release error fails the query or emission rather than serving ciphertext. Reducer models follow the same provenance rule.

On direct reads, release uses the model's `@subject()` property or `id`. It must match the subject used when appending the event: the kernel encrypts with the event's subject, stored as `__subject`. A mismatch fails release and therefore fails the query. A directly read model with only `@encrypted()` fields also needs `@subject()` or `id` in the TypeScript SDK; without either, release cannot identify the key and fails. An instance without a subject that holds no protected value, such as a masked copy that cleared its protected fields and dropped `id`, is served without a release; one that still holds a protected value fails the query.

### Release raw MongoDB documents

`MongoReadModels` returns raw driver documents, not class instances. To have Arc release them, name the read model they hold:

```ts
const people = new MongoReadModels<Document, PeopleInput>({
    client, databaseForTenant, filterFor,
    readModel: PersonView
}, 'personViews');
```

Each returned document is marked with the model, the request's tenant, and a subject. By default, the subject is the `__subject` Chronicle stored with the document, which is the subject it encrypted with, and otherwise the document's string or numeric `_id`. Use `subjectFor(document)` when neither holds the subject; it must still agree with any stored `__subject`. If a document has no usable subject, the read fails. When the query returns these documents directly, in an array, or in `queryPage`, Arc releases each one before serving it. This covers snapshots, pages, and observable emissions. Arc passes the document to `store.readModels.release` and serves `_id` plus the declared fields with Chronicle's released values.

Chronicle stores bookkeeping with every materialized document: `__lastHandledEventSequenceNumber`, `__initialized`, `__subject`, and `__subjects`. Arc does not release or serve these fields unless the read model declares them, just as the kernel strips them from its own reads.

The query fails rather than serving stored values when:

- the document has a field the read model's schema does not declare, including a name that differs only by case or naming policy;
- a value is not JSON: BSON `ObjectId`, `Binary`, and `Decimal128` are rejected, although `Date` is accepted. With the driver's default promotion, an int64 within the safe integer range (±2^53) arrives as a JavaScript number and is accepted; only int64 values outside that range, which arrive as a BSON `Long` (or a `bigint` with `useBigInt64`), are rejected. A `Guid` field stored as a BSON `Binary` UUID therefore fails the read; the key in `_id` is served as stored and is not checked;
- an object or array does not have a declared schema;
- the document's `id` or `@subject()` value, or its stored `__subject`, differs from the marked subject;
- the document has per-property subjects in a non-empty `__subjects`, which Chronicle stores for models that join personal data from several subjects. Arc cannot release these yet; read such models through `ChronicleReadModels`;
- the request's tenant differs from the marked tenant;
- Chronicle fails to release the document or omits a field;
- a typed raw document is nested inside another returned shape, such as `MongoReadModels.page()`'s `MongoPage`. Return `queryPage` instead.
- an instance of a protected read-model class is nested inside another returned shape, such as the object a joined `select((books, authors) => ({ books, authors }))` builds, unless Chronicle released it. Arc intercepts only the value a query returns, its array items, and its page items. Chronicle-released instances, from `ChronicleReadModels`, may be nested.

The typed `find`, `findById`, `page`, and `queryPage` calls reject a MongoDB `projection`, because partial documents are DTO projections.

### What Arc does not release

On the typed path, the boundary covers **exact read-model classes** and **raw documents typed with `readModel`**, when the model is registered in the Chronicle artifact catalog. Arc serves these as stored:

- untyped `MongoReadModels` documents and other raw driver documents;
- derived subtypes selected by the codec;
- DTOs, mapped objects, and copies of typed raw documents, because a copy loses its marking;
- typed raw documents that handler code hides where Arc's check cannot see them: behind `toJSON()`, a getter, a private field, or inside a `Map` or `Set`. Arc only inspects own enumerable values. Return the documents themselves;
- `MongoDBWatcher.changes()` payloads. The `fullDocument` of a change is a raw, unmarked document, so a protected model's fields arrive as ciphertext. Release them yourself or read the changed model through a query;
- typed raw documents of a model that is not registered with `withChronicle`, because Arc cannot tell whether such a model is protected.

For these paths, call the tenant store's `readModels.release` before serving protected data.

In-memory sorting of a directly read array by an encrypted field orders by ciphertext; database-side sorting on encrypted fields is inherently meaningless.

The live integration check inspects raw MongoDB storage for ciphertext and verifies plaintext through Chronicle HTTP snapshots, observable emissions, command injection, and an Arc query using `MongoCollection` to decode the materialized collection into the exact class. The raw `MongoReadModels` path is checked by specs that use a Chronicle substitute to serve snapshots, pages, and observable SSE through Express, Fastify, and Hono, and by the kernel integration, which reads a document the kernel materialized, bookkeeping included, through `MongoReadModels` on each adapter.

:::caution[Release is not authorization]
Decide separately who may read a person's data.
:::

## Subject and authentication are different

The subject is whose data an event holds. The signed-in principal is who asked for the change. Arc never derives one from the other. A support agent correcting a customer's address is the principal; the customer is the subject.

## Related

- [Subject](commands/subject.md)
- [Causation and auditing](commands/causation.md)
- [Chronicle compliance](/chronicle/compliance/)
- [Capability reference](../reference/capabilities.md#persistence-and-chronicle)
