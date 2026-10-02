// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, DateOnly, field, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';

export enum Status { Draft, Published }
export enum Label { First = 'first', Last = 'last' }
export class Name extends ConceptAs<string> {}
export class DerivedName extends Name {}
export class GenericConcept<T> extends ConceptAs<T> {}
export class GenericIntermediate<T> extends GenericConcept<T> {}
export class GenericName extends GenericIntermediate<string> {}
export class Amount extends ConceptAs<number> {}
export class Enabled extends ConceptAs<boolean> {}
export class Timestamp extends ConceptAs<Date> {}
export class Identifier extends ConceptAs<Guid> {}
export class Day extends ConceptAs<DateOnly> {}
export class Time extends ConceptAs<TimeOnly> {}
export class Duration extends ConceptAs<TimeSpan> {}
export class State extends ConceptAs<Status> {}

export class ScalarFields {
    @field(String) name!: string;
    @field(Number) amount!: number;
    @field(Boolean) enabled!: boolean;
    @field(Date) timestamp!: Date;
    @field(Guid) identifier!: Guid;
    @field(DateOnly) day!: DateOnly;
    @field(TimeOnly) time!: TimeOnly;
    @field(TimeSpan) duration!: TimeSpan;
    @field(Number) status!: Status;
    @field(String) label!: Label;
    @field(Name) conceptName!: Name;
    @field(DerivedName) derivedName!: DerivedName;
    @field(GenericName) genericName!: GenericName;
    @field(Amount) conceptAmount!: Amount;
    @field(Enabled) conceptEnabled!: Enabled;
    @field(Timestamp) conceptTimestamp!: Timestamp;
    @field(Identifier) conceptIdentifier!: Identifier;
    @field(Day) conceptDay!: Day;
    @field(Time) conceptTime!: Time;
    @field(Duration) conceptDuration!: Duration;
    @field(State) conceptStatus!: State;
}
