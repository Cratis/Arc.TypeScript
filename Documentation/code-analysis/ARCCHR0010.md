---
title: ARCCHR0010 — Raw Guid response does not set the event source id
description: Use eventSourceIdResponse when a keyless command's Guid response is meant to select the event source.
---

For a keyless `@command()`, `tuple(Guid.parse('...'), new Created())` sends the Guid to the caller
as an ordinary response. Chronicle still chooses a fallback event source ID. If the ID should
identify the new stream, return `tuple(eventSourceIdResponse(id), new Created())` or supply the
command key through `@key()`, `getKey()`, or `getEventSourceId()`.

This type-checked rule recognizes fundamentals `Guid` values including `Guid.create()`,
`Guid.parse(...)`, and variables, beside a direct `new` event decorated with `@eventType()`
from `@cratis/chronicle` or `@cratis/chronicle/events`. It does not guess from string responses,
event factories, indirect return values, or inherited command keys or event-type decorators;
an ordinary Guid response may be intentional. See [Resolving the event source ID](../chronicle/resolving-event-source-id.md#return-the-id-to-the-caller).
