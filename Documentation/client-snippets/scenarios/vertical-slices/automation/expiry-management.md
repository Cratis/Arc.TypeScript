```typescript
import { field, Guid } from '@cratis/fundamentals';
import { command, commandReadModel, inject, key, readModel } from '@cratis/arc.core';
import { eventType, type EventContext } from '@cratis/chronicle/events';
import { fromEvent, passive, removedWith } from '@cratis/chronicle/projections';
import { onceOnly, reactor, type ReactorServices } from '@cratis/chronicle/reactors';
import { MemberId } from '../../Members/MemberId.js';
import { ISBN } from '../ISBN.js';
import { BookBorrowedFromReservation, BookReserved, ReservationCancelled } from '../ReservationEvents.js';
import { ReservationId } from '../ReservationId.js';

// Reservations/ExpiryManagement/ExpiryManagement.ts
// Events come first: a decorator can only reference a class that is already declared.

// ─── Events ───────────────────────────────────────────────────────────────────

/** Records the expiry of a reservation that was not collected in time. */
@eventType()
export class ReservationExpired {
    @field(ISBN) isbn: ISBN;
    @field(MemberId) memberId: MemberId;

    constructor(isbn = new ISBN(''), memberId = new MemberId(Guid.empty)) {
        this.isbn = isbn;
        this.memberId = memberId;
    }
}

/** Records the scheduler's daily opportunity to check overdue reservations. */
@eventType()
export class DailyTick {
    @field(Date) occurredAt: Date;

    constructor(occurredAt = new Date(0)) {
        this.occurredAt = occurredAt;
    }
}

// ─── Read Models ──────────────────────────────────────────────────────────────

@readModel()
@fromEvent(BookReserved)
@removedWith(BookBorrowedFromReservation)
@removedWith(ReservationCancelled)
@removedWith(ReservationExpired)
export class ReservationDueForExpiry {
    @field(ReservationId) id!: ReservationId;
    @field(Date) expiresAt!: Date;
}

@readModel()
@passive
@fromEvent(BookReserved)
@removedWith(BookBorrowedFromReservation)
@removedWith(ReservationCancelled)
@removedWith(ReservationExpired)
export class PendingReservation {
    @field(ReservationId) id!: ReservationId;
    @field(ISBN) isbn!: ISBN;
    @field(MemberId) memberId!: MemberId;
    @field(Date) expiresAt!: Date;
}

// ─── Command ──────────────────────────────────────────────────────────────────

@command()
export class CancelExpiredReservation {
    @key() @field(ReservationId) reservationId: ReservationId;

    constructor(reservationId = new ReservationId(Guid.empty)) {
        this.reservationId = reservationId;
    }

    provide(): Date {
        return new Date();
    }

    @inject(commandReadModel(PendingReservation, { optional: true }))
    handle(now: Date, reservation: PendingReservation | null): ReservationExpired | undefined {
        if (!reservation || reservation.expiresAt > now) {
            return undefined;
        }

        return new ReservationExpired(reservation.isbn, reservation.memberId);
    }
}

// ─── Reactor ──────────────────────────────────────────────────────────────────

@reactor()
export class ReservationExpiryReactor {
    @onceOnly()
    async dailyTick(event: DailyTick, _context: EventContext, services: ReactorServices): Promise<CancelExpiredReservation[]> {
        // The event arrives as parsed JSON, so its date is a string until converted.
        const occurredAt = new Date(event.occurredAt);
        const reservations = await services.readModels.getInstances(ReservationDueForExpiry);

        return reservations
            .filter(reservation => reservation.expiresAt <= occurredAt)
            .map(reservation => new CancelExpiredReservation(reservation.id));
    }
}
```
