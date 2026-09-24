---
title: Observable emission guards
description: Re-check every observable-query emission with scoped guards that allow, suppress, or deny and terminate the subscription.
---

Authorization runs once, when a subscription opens. A live query can outlive that decision: the caller's access may lapse, or some emissions should never leave the server. An emission guard checks every rendered result, including the first snapshot, before it is delivered.

## Write and register a guard

```typescript
import { field } from '@cratis/fundamentals';
import {
    ArcApplication, CurrentValueSubject, ObservableEmissionDecision, query, readModel, serviceToken,
    type ObservableEmissionContext, type ObservableEmissionGuard, type ObservableSource
} from '@cratis/arc.core';

const prices = CurrentValueSubject.of<Price[]>([]);

@readModel()
export class Price {
    @field(String) symbol!: string;
    @field(Number) amount!: number;

    @query({ observable: true })
    static livePrices(): ObservableSource<Price[]> { return prices; }
}

export const tradingHours = serviceToken<ObservableEmissionGuard>('tradingHours');

export class TradingHoursGuard implements ObservableEmissionGuard {
    check(emission: ObservableEmissionContext): ObservableEmissionDecision {
        if (!emission.context.principal) return ObservableEmissionDecision.DenyAndTerminate;
        return Array.isArray(emission.data) && emission.data.length === 0
            ? ObservableEmissionDecision.Suppress
            : ObservableEmissionDecision.Allow;
    }
}

const builder = ArcApplication.createBuilder({ observableEmissionGuards: [tradingHours] });
builder.services.addScoped(tradingHours, () => new TradingHoursGuard());
builder.add(Price);
```

Without an authenticated caller, `GET /api/live-prices` answers 403 with `isAuthorized: false`. With one, an empty list is suppressed, so the snapshot answers 202 with `isReady: false` until a non-empty list arrives.

## Decisions

| Decision | Effect |
| --- | --- |
| `Allow` | Deliver the result |
| `Suppress` | Withhold it without advancing the delta baseline |
| `DenyAndTerminate` | Send a terminal unauthorized result or hub frame and end the subscription |

The most restrictive decision across all guards wins. A guard that throws denies and ends the subscription, including while evaluating an HTTP snapshot, and the failure is logged.

## What a guard sees

`ObservableEmissionContext` carries `queryName`, the bound `input`, the rendered `data`, the execution `context` (principal, tenant, correlation), `isFirstEmission`, and a `signal`. Guards run in the subscription's service scope, after [renderers and interceptors](query-pipeline.md#result-stages), on an isolated copy of the context.

Register guard tokens with the `observableEmissionGuards` option, and register each token as a service.

## Related

- [Observable queries](observable-queries.md)
- [Authorizing commands and queries](../authorizing-commands-and-queries.md)
