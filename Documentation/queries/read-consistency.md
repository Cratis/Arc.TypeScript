---
title: Choose Chronicle read consistency
description: Select materialized or on-demand read models and optionally wait for observer completion after a command.
---

A successful Chronicle append commits the events; it does not, by default, mean a query of an active projection sees them yet. `ChronicleReadModels` and the Chronicle command options let you make the required consistency explicit without changing non-Chronicle Arc queries. This integration remains experimental.

| Choice | How to select | What a successful return establishes |
| --- | --- | --- |
| Default | `models.getById(View, id)` or `models.getAll(View)` | Chronicle SDK read. Active projections use their asynchronously materialized state; passive projections resolve on demand. |
| Immediate read | Mark the model-bound projection `@passive`, then call `models.getById(View, id, 'immediate')`, `models.findInstanceById(View, id, 'immediate')`, or `models.getAll(View, 'immediate')` | The SDK asks the kernel to compute the passive read model from events at query time. An active model passed as `immediate` is rejected, never silently served stale data. This does not promise a snapshot across concurrent queries. |
| Wait after write | Set `completionTimeoutMs: 10000` on `builder.withChronicle({ eventStore, client, completionTimeoutMs: 10000 })`; or on a `defineChronicleCommand` definition | Arc waits on the last successful append's `waitForCompletion` before returning success. The kernel reports when affected observers have caught up to that tail or failed. No fixed sleep or read-model polling. |

Without `completionTimeoutMs`, commands acknowledge persistence only. The timeout is a positive integer in milliseconds; the SDK bounds its completion RPC by that value (default opt-in value is **none**). Arc also cancels the caller's wait if the command context signal aborts. If observers fail or the wait times out, the command reports an exception, **not success**; the events may already be committed. Do not retry a non-idempotent command merely because the wait failed. The wait does not make reactors' external side effects atomic, and does not guarantee that a later query sees no newer concurrent writes.

The SDK's `getInstances`/`findInstanceById` choose sink versus on-demand based on how the read model was registered. Arc's explicit `immediate` mode is limited to passive **model-bound** projections, as identified by Chronicle's `@passive`; it does not convert an active projection or reducer into an on-demand read. For hot list views use active projections and tolerate a lag, or enable the bounded completion wait when a particular write must be visible before a follow-up query. See [Chronicle's read-model consistency guide](https://github.com/Cratis/Chronicle/blob/main/Documentation/read-models/consistency.md) for the kernel-side distinction.
