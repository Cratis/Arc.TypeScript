---
title: ARCCHR0010 — Raw Guid response does not set the event source id
description: Use eventSourceIdResponse when a keyless command's Guid response is meant to select the event source.
---

For a keyless `@command()`, `tuple(Guid.parse('...'), new Created())` sends the Guid to the caller
as an ordinary response. Chronicle still chooses a fallback event source ID. If the ID should
identify the new stream, return `tuple(eventSourceIdResponse(id), new Created())` or supply the
command key through `@key()`, `getKey()`, or `getEventSourceId()`.

This type-checked rule recognizes a direct `Guid.parse(...)` imported from `@cratis/fundamentals`
and a `new` event class decorated with `@eventType()` from `@cratis/chronicle/events`.
It does not guess from string responses, factories, indirect return values, or inherited command keys;
an ordinary Guid
response may be intentional. See [Resolving the event source ID](../chronicle/resolving-event-source-id.md#return-the-id-to-the-caller).
