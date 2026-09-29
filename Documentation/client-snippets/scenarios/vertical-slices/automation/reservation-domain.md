```typescript
import { ConceptAs, field, Guid } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { MemberId } from '../Members/MemberId.js';

// Reservations/ReservationId.ts
export class ReservationId extends ConceptAs<Guid> {
    static readonly valueType = Guid;

    static create(): ReservationId {
        return new ReservationId(Guid.create());
    }
}

// Reservations/ISBN.ts
export class ISBN extends ConceptAs<string> {
    static readonly valueType = String;
}

// Reservations/ReservationEvents.ts

/** Records a book held for a member until the collection deadline. */
@eventType()
export class BookReserved {
    @field(ISBN) isbn: ISBN;
    @field(MemberId) memberId: MemberId;
    @field(Date) expiresAt: Date;

    constructor(isbn = new ISBN(''), memberId = new MemberId(Guid.empty), expiresAt = new Date(0)) {
        this.isbn = isbn;
        this.memberId = memberId;
        this.expiresAt = expiresAt;
    }
}

/** Records that a reservation was canceled without collection. */
@eventType()
export class ReservationCancelled {
    @field(ISBN) isbn: ISBN;
    @field(MemberId) memberId: MemberId;

    constructor(isbn = new ISBN(''), memberId = new MemberId(Guid.empty)) {
        this.isbn = isbn;
        this.memberId = memberId;
    }
}

/** Records that the member collected the reserved book. */
@eventType()
export class BookBorrowedFromReservation {
    @field(ISBN) isbn: ISBN;
    @field(MemberId) memberId: MemberId;

    constructor(isbn = new ISBN(''), memberId = new MemberId(Guid.empty)) {
        this.isbn = isbn;
        this.memberId = memberId;
    }
}
```
