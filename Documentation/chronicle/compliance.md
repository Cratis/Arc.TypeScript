---
title: Compliance
description: What the experimental Chronicle integration does for personal data, subjects, and audit exclusion in TypeScript, and which parts of Arc on .NET's compliance support it does not have.
---

Events are immutable, yet a person can ask for their personal data to be erased. Chronicle resolves that tension by keying personal data to a **subject** and managing encryption keys per subject; destroying the key makes the data unreadable while the events stay. The [Chronicle compliance guide](/chronicle/compliance/) explains that side.

An Arc application meets compliance at two points: when a command appends events, and when a query serves the read models built from them. The TypeScript integration covers the first. It does not cover the second.

## What the integration does

| Concern | In Arc for TypeScript |
| --- | --- |
| Record the subject on appended events | Supported. `getSubject()`, a `@subject()` field, `@eventSubject(...)`, or a routed event's `subject`, falling back to the event source ID. See [Subject](commands/subject.md). |
| Keep command values out of the causation chain | Supported. `@notAudited()`, the SDK's `@pii()` on a command field or class, and secret-looking field names. See [Causation and auditing](commands/causation.md#keep-a-value-out). |
| Mark event or read-model data as personal | Done with the SDK's `@pii()` from `@cratis/chronicle/compliance`. Arc passes your event classes to the SDK unchanged. |
| Release encrypted values when a query serves a read model | **Not implemented.** Arc does not call Chronicle's release operation. |
| Release encrypted values in a command's read model | **Not implemented.** `commandReadModel(Type)` passes the instance as the SDK returns it. |
| Erase a subject's key | Not part of Arc. Use Chronicle's own tooling or the SDK's PII manager. |

## Releasing values is up to you

Arc on .NET releases personal data automatically through read-model interception before a response reaches the client. Arc for TypeScript has no equivalent. A query that returns a read model with values Chronicle encrypted returns them as stored.

The SDK exposes `release(Type, instance)` and `releaseMany(Type, instances)` on `store.readModels`, and `ChronicleReadModels.getStore()` gives you the tenant's store. Arc does not call them, and this repository does not check a release against a kernel. If your read models hold encrypted values, call release where you serve them, and test the result against a real kernel before relying on it.

Release is not authorization. Decide separately who may read a person's data.

## Subject and authentication are different

The subject is whose data an event holds. The signed-in principal is who asked for the change. Arc never derives one from the other. A support agent correcting a customer's address is the principal; the customer is the subject.

## Related

- [Subject](commands/subject.md)
- [Causation and auditing](commands/causation.md)
- [Chronicle compliance](/chronicle/compliance/)
- [Capability reference](../reference/capabilities.md#persistence-and-chronicle)
