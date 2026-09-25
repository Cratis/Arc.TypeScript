---
title: Compliance
description: What the experimental Chronicle integration does for personal data, subjects, and audit exclusion in TypeScript, and which parts of Arc on .NET's compliance support it does not have.
---

Events are immutable, yet a person can ask for their personal data to be erased. Chronicle resolves that tension by keying personal data to a **subject** and managing encryption keys per subject; destroying the key makes the data unreadable while the events stay. The [Chronicle compliance guide](/chronicle/compliance/) explains that side.

An Arc application meets compliance at two points: when a command appends events, and when a query serves the read models built from them. The TypeScript integration releases projected read models at Arc's query edge and for command injection.

## What the integration does

| Concern | In Arc for TypeScript |
| --- | --- |
| Record the subject on appended events | Supported. `getSubject()`, a `@subject()` field, `@eventSubject(...)`, or a routed event's `subject`, falling back to the event source ID. See [Subject](commands/subject.md). |
| Keep command values out of the causation chain | Supported. `@notAudited()`, the SDK's `@pii()` on a command field or class, and secret-looking field names. See [Causation and auditing](commands/causation.md#keep-a-value-out). |
| Mark event or read-model data as personal | Done with the SDK's `@pii()` from `@cratis/chronicle/compliance`. Arc passes your event classes to the SDK unchanged. |
| Release encrypted values when a query serves a read model | Arc releases Chronicle-backed projection models with SDK compliance schema metadata before returning a snapshot or observable emission. This also applies to items in arrays and pages. |
| Release encrypted values in a command's read model | Arc releases a projection returned by `commandReadModel(Type)` or a Chronicle validator read-model lookup before injection; null remains null. |
| Erase a subject's key | Not part of Arc. Use Chronicle's own tooling or the SDK's PII manager. |

## Where release happens

Arc registers a scoped read-model interceptor for Chronicle projections with compliance metadata in the SDK-generated schema. It calls `store.readModels.release(Type, instance)` on the tenant-scoped store after query rendering and paging, before wire encoding. The same interceptor runs for each observable delivery. Command read-model resolution releases projected models independently, before injection. A release error fails the query or command rather than returning stored ciphertext as success. The SDK already releases reducer reads and watches with top-level compliance metadata; Arc does not release reducers again.

This boundary matches **exact read-model classes** registered in the Chronicle artifact catalog. It does not traverse nested DTOs, release plain objects, or release values returned directly from `ChronicleReadModels.findInstanceById`, `getAll`, or `watch` to code outside Arc's query pipeline. Those methods forward projection results from the SDK; use the SDK's `store.readModels.release(Type, instance)` or `releaseMany(Type, instances)` when exposing those results through another route. The SDK's automatic reducer release only detects top-level compliance properties. Arc's projection selection follows schema compliance metadata (including nested properties), not standalone `security` metadata; do not assume encrypted-only or unsupported schema shapes are covered by this PII path.

The live integration check exercises HTTP snapshots, observable emissions, and command injection against a kernel. The tested `cratis/chronicle:latest-development` image materialized the `@pii()` fixture value **in plaintext**; that run confirms the delivery paths return plaintext but does **not** prove decryption of stored ciphertext. Verify encryption and release against your kernel and key configuration before depending on this behavior for personal data.

Release is not authorization. Decide separately who may read a person's data.

## Subject and authentication are different

The subject is whose data an event holds. The signed-in principal is who asked for the change. Arc never derives one from the other. A support agent correcting a customer's address is the principal; the customer is the subject.

## Related

- [Subject](commands/subject.md)
- [Causation and auditing](commands/causation.md)
- [Chronicle compliance](/chronicle/compliance/)
- [Capability reference](../reference/capabilities.md#persistence-and-chronicle)
