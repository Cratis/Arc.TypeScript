---
title: Test operations and compensation
description: Specify a command's declared operations directly, then run real execution, failure, and reverse-order compensation through CommandScenario with a fake provider.
---

A booking test has to answer more than "did the command return a reservation?" You also need to know that Arc calls the provider, stops after a failure, and cancels the reservations it already made. Written by hand, that is a rollback stack in the handler and a pile of mocks in the spec. With [command operations](../commands/operations/index.md), the handler only declares the work, and Arc runs it and compensates. This lesson shows how to prove each part without a server.

You first inspect the command's decision directly. Then you run the real operation pipeline through `CommandScenario`, including a provider failure halfway through a batch.

## Set up the lesson

Work inside your clone, as in [Test a command's decision](command-decisions.md), and create a folder the Tasks sample's Vitest project covers:

```bash
mkdir -p Samples/Tasks/Lessons/SeatBooking/for_BookSeat/given \
  Samples/Tasks/Lessons/SeatBooking/for_BookSeats/given \
  Samples/Tasks/Lessons/SeatBooking/for_ReserveSeat
```

The reservation provider is an application interface. The specs supply a Sinon fake, so nothing leaves the process.

## Declare the operation and the commands

```typescript title="Samples/Tasks/Lessons/SeatBooking/SeatBooking.ts"
import { field } from '@cratis/fundamentals';
import { command, CommandOperation, operations, serviceToken, tuple } from '@cratis/arc.core';

export interface SeatReservations {
    reserve(reservation: string, seat: string, signal: AbortSignal): Promise<void>;
    cancel(reservation: string, signal: AbortSignal): Promise<void>;
}
export const seatReservations = serviceToken<SeatReservations>('seatReservations');

export class ReserveSeat extends CommandOperation {
    readonly executeDependencies = [seatReservations] as const;
    readonly compensateDependencies = [seatReservations] as const;

    constructor(readonly reservation: string, readonly seat: string) { super(); }

    execute(signal: AbortSignal, reservations: SeatReservations): Promise<void> {
        return reservations.reserve(this.reservation, this.seat, signal);
    }

    compensate(_failure: unknown, signal: AbortSignal, reservations: SeatReservations): Promise<void> {
        return reservations.cancel(this.reservation, signal);
    }
}

@command()
export class BookSeat {
    @field(String) reservation!: string;
    @field(String) seat!: string;

    handle() {
        return tuple(this.reservation, new ReserveSeat(this.reservation, this.seat));
    }
}

export class SeatRequest {
    @field(String) reservation!: string;
    @field(String) seat!: string;
}

@command()
export class BookSeats {
    @field(Array, { genericArguments: [SeatRequest] }) requests!: SeatRequest[];

    handle() {
        return operations(...this.requests.map(request => new ReserveSeat(request.reservation, request.seat)));
    }
}
```

`BookSeat.handle()` returns two values: the reservation ID for the caller, and a `ReserveSeat` operation that Arc runs on the server. `BookSeats` returns an explicit batch of operations. Neither handler calls the provider. `ReserveSeat` names its dependencies with a service token, and Arc resolves them before it starts the first operation.

## Specify the decision without infrastructure

```typescript title="Samples/Tasks/Lessons/SeatBooking/for_BookSeat/when_deciding_to_book.ts"
import { BookSeat, ReserveSeat } from '../SeatBooking.js';

describe('when deciding to book a seat', () => {
    let decision: ReturnType<BookSeat['handle']>;

    beforeEach(() => {
        decision = Object.assign(new BookSeat(), { reservation: 'r-1', seat: 'A-12' }).handle();
    });

    it('should return the reservation as the response', () => { decision.values[0].should.equal('r-1'); });
    it('should declare the requested reservation', () => {
        decision.values[1].should.be.instanceOf(ReserveSeat);
        decision.values[1].should.include({ reservation: 'r-1', seat: 'A-12' });
    });
});
```

Calling `handle()` only returns the declaration. No provider exists in this spec, and nothing was reserved: the operation is data you can inspect. Add decision branches here when booking becomes conditional.

## Specify the provider adapter directly

The operation's own `execute()` maps its data to the provider call. Test that mapping on its own:

```typescript title="Samples/Tasks/Lessons/SeatBooking/for_ReserveSeat/when_reserving_directly.ts"
import sinon from 'sinon';
import { ReserveSeat, type SeatReservations } from '../SeatBooking.js';

describe('when reserving a seat directly', () => {
    const signal = new AbortController().signal;
    let reservations: { reserve: sinon.SinonStub; cancel: sinon.SinonStub };

    beforeEach(async () => {
        reservations = { reserve: sinon.stub().resolves(), cancel: sinon.stub().resolves() };
        await new ReserveSeat('r-1', 'A-12').execute(signal, reservations as SeatReservations);
    });

    it('should reserve the requested seat', () => { reservations.reserve.should.have.been.calledOnceWith('r-1', 'A-12', signal); });
    it('should not cancel the reservation', () => { reservations.cancel.called.should.equal(false); });
});
```

This tests your adapter, not Arc's orchestration. Calling `execute()` yourself never compensates on failure. The next specs cross that boundary on purpose.

## Execute through CommandScenario

```typescript title="Samples/Tasks/Lessons/SeatBooking/for_BookSeat/given/a_booking.ts"
import { CommandScenario } from '@cratis/arc.testing';
import sinon from 'sinon';
import { BookSeat, seatReservations } from '../../SeatBooking.js';

export class a_booking {
    reservations = { reserve: sinon.stub().resolves(), cancel: sinon.stub().resolves() };
    scenario = CommandScenario.for(BookSeat);

    constructor() { this.scenario.services.addSingleton(seatReservations, this.reservations); }
}
```

```typescript title="Samples/Tasks/Lessons/SeatBooking/for_BookSeat/when_booking_through_arc.ts"
import { CommandRecoveryStatus } from '@cratis/arc.core';
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { ReserveSeat } from '../SeatBooking.js';
import { a_booking } from './given/a_booking.js';

describe('when booking a seat through Arc', given(a_booking, context => {
    let result: ScenarioCommandResult;

    beforeAll(async () => { result = await context.scenario.execute({ reservation: 'r-1', seat: 'A-12' }); });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should succeed', () => { result.shouldBeSuccessful(); });
    it('should call the provider', () => { context.reservations.reserve.should.have.been.calledOnceWith('r-1', 'A-12'); });
    it('should observe the completed execution', () => { result.shouldHaveExecutedOperation(ReserveSeat); });
    it('should not need recovery', () => { result.recovery!.status.should.equal(CommandRecoveryStatus.NotNeeded); });
    it('should return only the caller response', () => { (result.response as string).should.equal('r-1'); });
}));
```

Now Arc does the work. It resolves `seatReservations`, calls `ReserveSeat.execute()`, and sends back only the reservation ID; the operation never reaches the caller. `shouldHaveExecutedOperation` and `result.recovery` report what the pipeline actually observed, not what a stub pretended. `recovery` and `operationOutcomes` exist on results from direct calls and scenarios only; they are never serialized to HTTP.

A validation-only call must not touch the provider at all:

```typescript title="Samples/Tasks/Lessons/SeatBooking/for_BookSeat/when_validating_a_booking.ts"
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import { a_booking } from './given/a_booking.js';

describe('when validating a booking', given(a_booking, context => {
    let result: ScenarioCommandResult;

    beforeAll(async () => { result = await context.scenario.validate({ reservation: 'r-1', seat: 'A-12' }); });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should be valid', () => { result.shouldBeSuccessful(); });
    it('should not enter any operation', () => { result.shouldHaveNoOperationInvocations(); });
    it('should not call the provider', () => { context.reservations.reserve.called.should.equal(false); });
}));
```

## Prove compensation after a partial failure

Now make the second of three reservations fail. The first two operations enter `execute()`; the third must never start. Arc should cancel the second reservation first, because the provider may have accepted it before reporting the failure, and then the first.

```typescript title="Samples/Tasks/Lessons/SeatBooking/for_BookSeats/given/three_seat_requests.ts"
import { CommandScenario } from '@cratis/arc.testing';
import sinon from 'sinon';
import { BookSeats, seatReservations } from '../../SeatBooking.js';

export class three_seat_requests {
    reservations = { reserve: sinon.stub().resolves(), cancel: sinon.stub().resolves() };
    scenario = CommandScenario.for(BookSeats);
    requests = [
        { reservation: 'r-1', seat: 'A-12' },
        { reservation: 'r-2', seat: 'A-13' },
        { reservation: 'r-3', seat: 'A-14' }
    ];

    constructor() { this.scenario.services.addSingleton(seatReservations, this.reservations); }
}
```

```typescript title="Samples/Tasks/Lessons/SeatBooking/for_BookSeats/when_the_second_reservation_fails.ts"
import { CommandRecoveryStatus } from '@cratis/arc.core';
import { given, type ScenarioCommandResult } from '@cratis/arc.testing';
import sinon from 'sinon';
import { ReserveSeat } from '../SeatBooking.js';
import { three_seat_requests } from './given/three_seat_requests.js';

describe('when the second reservation fails', given(three_seat_requests, context => {
    let result: ScenarioCommandResult;

    beforeAll(async () => {
        context.reservations.reserve.withArgs('r-2').rejects(new Error('Reservation provider unavailable'));
        result = await context.scenario.execute({ requests: context.requests });
    });
    afterAll(async () => { await context.scenario.dispose(); });

    it('should not succeed', () => { result.shouldNotBeSuccessful(); });
    it('should keep the original error', () => {
        result.exceptionMessages.should.include('Error: Reservation provider unavailable');
    });
    it('should enter only the first two operations', () => { result.recovery!.startedCount.should.equal(2); });
    it('should not start the third reservation', () => {
        context.reservations.reserve.should.not.have.been.calledWith('r-3');
    });
    it('should observe the first execution completing', () => { result.operationOutcomes![0]!.executionCompleted.should.equal(true); });
    it('should observe the second execution failing', () => { result.operationOutcomes![1]!.executionCompleted.should.equal(false); });
    it('should compensate in reverse order', () => {
        sinon.assert.callOrder(context.reservations.cancel.withArgs('r-2'), context.reservations.cancel.withArgs('r-1'));
    });
    it('should report both compensations', () => {
        result.shouldHaveCompensatedOperation(ReserveSeat);
        result.recovery!.compensatedCount.should.equal(2);
    });
    it('should report completed recovery', () => { result.recovery!.status.should.equal(CommandRecoveryStatus.Completed); });
}));
```

Each assertion proves something different. A lone `shouldNotBeSuccessful()` would also pass if a service were missing before any operation ran; the provider calls, the skipped third reservation, and the recovery counts rule that out. Neither the command nor the spec contains a rollback stack: Arc tracked what it started and compensated it in reverse.

`Completed` means both compensation callbacks returned. A fake cannot prove that a real provider made the cancellation durable, or that a slow reservation will not appear later. Test those guarantees against the provider itself.

## Run the lesson

```bash
yarn vitest run Samples/Tasks/Lessons/SeatBooking
```

Twenty-one tests pass across five spec files. Delete `Samples/Tasks/Lessons` when you are done.

## What you proved, and what comes next

You have specified the declared decision, the provider adapter, successful composition through Arc, a validation call that touches nothing, and reverse-order recovery after a failure in the middle of a batch.

Some cases need more than a fake:

- **Cancellation.** Compensation receives its own signal, not the request's aborted one, with a shared budget set by `commandCompensationTimeoutMs`; see [Implementing operations](../commands/operations/implementing.md).
- **Commit facts.** When an execution scope commits business changes, its reported disposition decides whether Arc compensates at all. `shouldHaveIndeterminateRecovery()` asserts the `Unknown` and `Mixed` cases; see the [operations reference](../commands/operations/reference.md).
- **The real provider.** Idempotency, key reuse, and delayed creation after a cancellation are the provider's guarantees. Only integration tests against it can establish them.

Return to [Testing](index.md) to choose the next boundary, or read [Testing commands](commands.md) for every scenario assertion.
