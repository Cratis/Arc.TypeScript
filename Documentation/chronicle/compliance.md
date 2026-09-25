---
title: Compliance
description: What the experimental Chronicle integration does for personal data, subjects, and audit exclusion in TypeScript, and which parts of Arc on .NET's compliance support it does not have.
---

Events are immutable, yet a person can ask for their personal data to be erased. Chronicle resolves that tension by keying personal data to a **subject** and managing encryption keys per subject; destroying the key makes the data unreadable while the events stay. The [Chronicle compliance guide](/chronicle/compliance/) explains that side.

An Arc application meets compliance at two points: when a command appends events, and when a query serves the read models built from them. Chronicle releases read models on kernel reads; Arc releases protected models read outside the kernel at its query edge.

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

Mark the **read-model property** `@pii()` as well as the event property when projected personal data must be encrypted at rest. Marking only the event protects the event log but leaves the projected read-model field in plaintext. The kernel decrypts on reads through Chronicle (including `ChronicleReadModels` snapshots, observations, watches, and command injection); Arc does not release those instances again.

Arc registers a scoped interceptor for Chronicle read-model classes with compliance or `@encrypted()` security metadata anywhere in their schema, including nested objects and array items. When a query returns an instance read **directly from the materialized MongoDB collection** (for example, through `@cratis/arc.mongodb`), Arc calls `store.readModels.release(Type, instance)` on the tenant store before wire encoding, for snapshots and observable deliveries. A release error fails the query or emission rather than serving ciphertext. A PII read model without `@subject()` or an `id` cannot identify whose key to use and fails on this direct-read path. Reducer models follow the same provenance rule.

The boundary matches **exact read-model classes** registered in the Chronicle artifact catalog. It does not traverse arbitrary DTOs or release plain objects. The live integration check inspects raw MongoDB storage for ciphertext and verifies plaintext through Chronicle HTTP snapshots, observable emissions, command injection, and an Arc query using `@cratis/arc.mongodb` to read the materialized collection directly.

Release is not authorization. Decide separately who may read a person's data.

## Subject and authentication are different

The subject is whose data an event holds. The signed-in principal is who asked for the change. Arc never derives one from the other. A support agent correcting a customer's address is the principal; the customer is the subject.

## Related

- [Subject](commands/subject.md)
- [Causation and auditing](commands/causation.md)
- [Chronicle compliance](/chronicle/compliance/)
- [Capability reference](../reference/capabilities.md#persistence-and-chronicle)
