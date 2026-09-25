---
title: Test a command's decision and its pipeline
description: Learn when to call handle() directly and when to run CommandScenario, using one shipping-quote command that separates acquiring data from deciding.
---

A shipping quote has two different things to prove: **the calculation is right**, and **Arc validates the input and fetches the rate before calculating**. You need no server for either, but they are different tests. A spec that only runs the whole pipeline is slow to write for every tariff edge case; a spec that only calls the method never notices when a validator stops running.

In this lesson you write one fast spec that calls `handle()` directly, then two `CommandScenario` specs that run the real pipeline. None of them needs a database, Chronicle, or an HTTP server.

## Set up the lesson

Arc for TypeScript is a source preview, so work inside your clone of this repository, where `@cratis/arc.core`, `@cratis/arc.testing`, Vitest, Chai's `should`, and Sinon are already configured. Create the lesson folder under the Tasks sample, which the repository's Vitest projects already cover:

```bash
mkdir -p Samples/Tasks/Lessons/Shipping/for_QuoteShipping/given
```

The Tasks server only discovers `Samples/Tasks/Features/`, so these files never become routes. Delete the `Lessons` folder when you are done.

## Keep acquiring data separate from deciding

Create the command, its value types, and a rule for the weight:

```typescript title="Samples/Tasks/Lessons/Shipping/QuoteShipping.ts"
import { ConceptAs, field } from '@cratis/fundamentals';
import { command, ConceptValidator, inject, serviceToken, validator } from '@cratis/arc.core';

export class ParcelWeight extends ConceptAs<number> { static readonly valueType = Number; }
export class RatePerKilogram extends ConceptAs<number> { static readonly valueType = Number; }
export class ShippingCost extends ConceptAs<number> { static readonly valueType = Number; }

export interface RateCard {
    currentRate(): Promise<RatePerKilogram>;
}
export const rateCard = serviceToken<RateCard>('rateCard');

@command()
export class QuoteShipping {
    @field(ParcelWeight) weight!: ParcelWeight;

    @inject(rateCard)
    provide(rates: RateCard): Promise<RatePerKilogram> {
        return rates.currentRate();
    }

    handle(rate: RatePerKilogram): ShippingCost {
        return new ShippingCost(this.weight.value * rate.value);
    }
}

@validator(ParcelWeight)
export class ParcelWeightValidator extends ConceptValidator<ParcelWeight> {
    constructor() {
        super();
        this.ruleFor(weight => weight.value).greaterThan(0).withMessage('Parcel weight must be positive');
    }
}
```

The weight is in kilograms, and the rate and cost share one currency. They are separate concepts so a weight, a rate, and a cost cannot trade places without the compiler noticing.

`provide()` acquires the rate through the `RateCard` service, and its result becomes the first argument of `handle()`. `handle()` only multiplies: the same weight and rate always produce the same cost, with no I/O, clock, or randomness. That makes it a **pure function**. Arc does not require pure handlers; the split pays off when fetching data would otherwise hide the decision.

`ParcelWeightValidator` belongs to the value, not to this command, so it runs for every command that carries a `ParcelWeight`. Calling `handle()` yourself runs neither the validator nor `provide()`.

## Specify the decision directly

```typescript title="Samples/Tasks/Lessons/Shipping/for_QuoteShipping/when_quoting_directly.ts"
import { ParcelWeight, QuoteShipping, RatePerKilogram, ShippingCost } from '../QuoteShipping.js';

describe('when quoting shipping directly', () => {
    let cost: ShippingCost;

    beforeEach(() => {
        const quote = Object.assign(new QuoteShipping(), { weight: new ParcelWeight(2.5) });
        cost = quote.handle(new RatePerKilogram(4));
    });

    it('should quote ten currency units', () => { cost.value.should.equal(10); });
});
```

Run it:

```bash
yarn vitest run Samples/Tasks/Lessons/Shipping/for_QuoteShipping/when_quoting_directly.ts
```

The spec passes when 2.5 kilograms at 4 per kilogram costs 10. There is no service container, no fake rate card, and no Arc in this test. Add cases here when the calculation grows thresholds, rounding, or tariffs: each one costs a few lines and runs in milliseconds.

## Prove that Arc connects the pieces

The direct spec cannot tell you whether Arc still fetches the rate, or whether the weight rule runs. That is the pipeline's job, so test it through the pipeline. Start with a context both scenario specs share:

```typescript title="Samples/Tasks/Lessons/Shipping/for_QuoteShipping/given/a_quote_scenario.ts"
import { CommandScenario } from '@cratis/arc.testing';
import sinon from 'sinon';
import { ParcelWeightValidator, QuoteShipping, rateCard, RatePerKilogram } from '../../QuoteShipping.js';

export class a_quote_scenario {
    currentRate = sinon.stub().resolves(new RatePerKilogram(4));
    scenario = CommandScenario.for(QuoteShipping, ParcelWeightValidator);

    constructor() {
        this.scenario.services.addSingleton(rateCard, { currentRate: this.currentRate });
    }
}
```

`CommandScenario.for` takes the command and the other decorated artifacts it needs; it cannot find a validator you never imported. Register the fake rate card before the first call, because the scenario builds its application lazily on first use.

```typescript title="Samples/Tasks/Lessons/Shipping/for_QuoteShipping/when_quoting_through_arc.ts"
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { ParcelWeight } from '../QuoteShipping.js';
import { a_quote_scenario } from './given/a_quote_scenario.js';

describe('when quoting shipping through Arc', given(a_quote_scenario, context => {
    let result: ScenarioCommandResult;

    beforeAll(async () => {
        result = await context.scenario.execute({ weight: new ParcelWeight(2.5) });
    });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should succeed', () => { result.shouldBeSuccessful(); });
    it('should acquire the rate once', () => { context.currentRate.callCount.should.equal(1); });
    it('should return the calculated cost', () => { (result.response as number).should.equal(10); });
}));
```

This time the boundary is the point. `execute()` encodes the input to the wire shape, runs the concept validator, calls `provide()` with the registered rate card, hands the rate to `handle()`, and encodes the response. The cost comes back as the number `10`, not a `ShippingCost`, because the result is what a client would receive.

`given(...)` creates one context for the whole `describe`, so the action runs once in `beforeAll` and the scenario is disposed in `afterAll`.

## Prove rejected input never reaches the rate card

```typescript title="Samples/Tasks/Lessons/Shipping/for_QuoteShipping/when_quoting_an_unset_weight.ts"
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { ParcelWeight } from '../QuoteShipping.js';
import { a_quote_scenario } from './given/a_quote_scenario.js';

describe('when quoting an unset weight', given(a_quote_scenario, context => {
    let result: ScenarioCommandResult;

    beforeAll(async () => {
        result = await context.scenario.execute({ weight: new ParcelWeight(0) });
    });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should reject the weight', () => {
        result.shouldHaveValidationErrorForMember('weight').shouldHaveValidationErrorFor('Parcel weight must be positive');
    });
    it('should not acquire a rate', () => { context.currentRate.called.should.equal(false); });
}));
```

Run all three specs:

```bash
yarn vitest run Samples/Tasks/Lessons/Shipping
```

Six tests pass. They answer three different questions: is the calculation right, does Arc compose the pieces, and does bad input stop before any work. Asserting both the member and the message, and that the rate card was never called, keeps an unrelated failure, such as a missing service, from passing as the expected rejection.

## What you proved, and what you did not

You have fast specs for the decision and focused specs for Arc's composition. You have **not** tested an HTTP route, an authentication handler, or a real rate-card implementation. Test those where they are introduced, rather than adding infrastructure to every arithmetic case:

| What you need to prove | Start with | It does not prove |
| --- | --- | --- |
| A calculation or decision | A direct `handle()` spec with explicit inputs | Validation, authorization, `provide()`, or services |
| Validation, authorization, `provide()`, services, and the response | `CommandScenario` | HTTP routing, authentication handlers, or real infrastructure |
| Operations executing and compensating in order | `CommandScenario` with fake providers | That a real provider undid anything |
| The route, the host, and authentication | `ArcScenario` with HTTP requests; see [Low-level definitions and HTTP](low-level-definitions.md) | Business edge cases you did not send |

## Next step

A handler that performs side effects can return them as [command operations](../commands/operations/index.md) instead of calling services directly. [Test operations and compensation](command-operations.md) extends this lesson to prove that Arc runs them, stops after a failure, and undoes the work it started.
