---
title: Compliance
description: What the experimental Chronicle integration does for personal data, subjects, and audit exclusion in TypeScript, and which parts of Arc on .NET's compliance support it does not have.
---

Events are immutable, yet a person can ask for their personal data to be erased. Chronicle resolves that tension by keying personal data to a **subject** and managing encryption keys per subject; destroying the key makes the data unreadable while the events stay. The [Chronicle compliance guide](/chronicle/compliance/) explains that side.

An Arc application meets compliance at two points: when a command appends events, and when a query serves the read models built from them. Chronicle (the kernel, or the SDK for reducer read models) releases read models on Chronicle reads. Arc releases protected models decoded into their exact read-model class from a direct collection read at its query edge.

## What the integration does

| Concern | In Arc for TypeScript |
| --- | --- |
| Record the subject on appended events | Supported. `getSubject()`, a `@subject()` field, `@eventSubject(...)`, or a routed event's `subject`, falling back to the event source ID. See [Subject](commands/subject.md). |
| Keep command values out of the causation chain | Supported. `@notAudited()`, the SDK's `@pii()` on a command field or class, and secret-looking field names. See [Causation and auditing](commands/causation.md#keep-a-value-out). |
| Mark event or read-model data as personal | Done with the SDK's `@pii()` from `@cratis/chronicle/compliance`. Arc passes your event classes to the SDK unchanged. |
| Release encrypted values when a query serves a read model | Kernel reads through Chronicle already return plaintext. Arc releases a protected Chronicle read model read directly from its materialized MongoDB collection, including items in snapshots, arrays, pages, and observable emissions. |
| Release encrypted values in a command's read model | The Chronicle kernel releases read models before `commandReadModel(Type)` or a Chronicle validator read-model lookup returns them; null remains null. |
| Erase a subject's key | Not part of Arc. Use Chronicle's own tooling or the SDK's PII manager. |

## Where release happens

Mark the **read-model property** `@pii()` as well as the event property when projected personal data must be encrypted at rest. Marking only the event protects the event log but leaves the projected read-model field in plaintext.

Chronicle releases values on reads through Chronicle, including `ChronicleReadModels` snapshots, observations, watches, and command injection. Arc does not release those instances again. Instances obtained by calling the SDK directly through `ChronicleReadModels.getStore()`, or clones of released instances, may receive an extra, harmless release at the Arc query edge.

### Release at the Arc query edge

Arc registers a scoped interceptor for Chronicle read-model classes with compliance or `@encrypted()` security metadata anywhere in their schema, including nested objects and array items. When a query returns an instance decoded **into the exact read-model class** from the materialized MongoDB collection (for example, through `@cratis/arc.mongodb`'s `MongoCollection`), Arc calls `store.readModels.release(Type, instance)` on the tenant store before wire encoding, for snapshots and observable deliveries. A release error fails the query or emission rather than serving ciphertext. Reducer models follow the same provenance rule.

On direct reads, release uses the model's `@subject()` property or `id`. It must match the subject used when appending the event: the kernel encrypts with the event's subject, stored as `__subject`. A mismatch fails release and therefore fails the query. A directly read model with only `@encrypted()` fields also needs `@subject()` or `id` in the TypeScript SDK; without either, release cannot identify the key and fails.

### What Arc does not release

The boundary matches **exact read-model classes** registered in the Chronicle artifact catalog. `MongoReadModels` returns raw driver documents, not decoded class instances. Those documents, other raw driver documents, derived subtypes selected by the codec, and DTOs or mapped objects are served as stored. Applications must call the tenant store's `readModels.release` explicitly for these paths before serving protected data.

In-memory sorting of a directly read array by an encrypted field orders by ciphertext; database-side sorting on encrypted fields is inherently meaningless.

The live integration check inspects raw MongoDB storage for ciphertext and verifies plaintext through Chronicle HTTP snapshots, observable emissions, command injection, and an Arc query using `MongoCollection` to decode the materialized collection into the exact class.

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
