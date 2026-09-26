---
title: ARCCHR0006 — Reactor returning commands needs a replay decision
description: Declare how a Chronicle reactor that returns an Arc command behaves during replay.
---

A reactor returning an Arc `@command()` instance (or an array of commands) runs that command again
when Chronicle replays the event. Decide whether replay should run the effect: mark the reactor or
individual handler `@onceOnly()` to skip it, or provide an alternate `@replay()` handler for the
same event. This is a type-checked analog of the .NET warning for `ICommandPipeline.Execute`;
ESLint reports it as an error in the `recommended-type-checked` preset.

```ts
import { onceOnly, reactor } from '@cratis/chronicle/reactors';

@reactor()
class StockKeeping {
    @onceOnly()
    bookReserved(event: BookReserved): DecreaseStock {
        return new DecreaseStock(event.isbn);
    }
}
```

`@onceOnly()` is a replay decision, not duplicate protection: failed-partition recovery can still
re-deliver an event and run the command again. Do not use once-only if replay needs to rebuild the
side effect. Instead use `@replay()` on a separate method: `replayBookReserved()` for an event class
named `BookReserved`, or `@replay(BookReserved)` on a differently named method. Chronicle chooses
handlers by the event class name, **not** by the TypeScript type annotation of the first parameter.
An alternate replay handler takes over for that event even if it returns nothing. See
[Returning commands from a reactor](../chronicle/reactors/command-side-effects.md#when-a-command-fails).

The rule recognizes `@reactor()`, `@onceOnly()`, and `@replay()` imported from
`@cratis/chronicle/reactors` or `@cratis/chronicle`, and return expressions whose checked type is
an Arc `@command()` class (including promises and arrays). It follows direct `this.method()` calls
inside the same reactor through helpers and reports at the return site, naming undecided handlers
that reach it. The live handler must have the event class's camel-cased name and a first parameter
typed as a decorated `@eventType()` class. A replay handler must name that event by convention or
pass its constructor to `@replay(Event)`; a replay handler for another event does not count.

This is bounded static analysis: it does not prove artifact registration, follow calls through
other objects or inherited helpers, infer commands behind erased `unknown`/`any` values, or find
commands executed manually through an Arc server instead of returned. Calls to same-class helpers
are treated as reachable even when their result is discarded or they run conditionally; inspect
such reports in context. It does not assess whether replay and retries are safe for a particular
command. [Chronicle code analysis](../chronicle/code-analysis.md) maps the remaining diagnostics.
