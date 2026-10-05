// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, DateOnly, field, Guid } from '@cratis/fundamentals';
import { nullable } from '@cratis/arc.core';

export class Id extends ConceptAs<Guid> {}
export class DerivedId extends Id {}
export class Count extends ConceptAs<number> {}
export class DerivedCount extends Count {}
export class Moment extends ConceptAs<Date> {}
export class DerivedMoment extends Moment {}
export class Day extends ConceptAs<DateOnly> {}
export class DerivedDay extends Day {}
export class Name extends ConceptAs<string> {}
export class MiddleName extends Name {}
export class DeepName extends MiddleName {}
export class Wrapper<T> extends ConceptAs<T> {}
export class TextWrapper extends Wrapper<string> {}
export class NumberWrapper extends Wrapper<number> {}
export class Literal extends ConceptAs<'plain' | '*/'> {}
export class DerivedLiteral extends Literal {}

export class IndirectConceptFields {
    @field(DerivedId) id!: DerivedId;
    @field(DerivedCount) count!: DerivedCount;
    @field(DerivedMoment) moment!: DerivedMoment;
    @field(DerivedDay) day!: DerivedDay;
    @field(DeepName) deepName!: DeepName;
    @field(TextWrapper) text!: TextWrapper;
    @field(NumberWrapper) number!: NumberWrapper;
    @field(DerivedLiteral) literal!: DerivedLiteral;
    @field(DerivedCount) @nullable() maybeCount!: DerivedCount | null;
    @field(DerivedId, true) ids!: DerivedId[];
    @field(DeepName, true) @nullable() maybeNames!: DeepName[] | null;
}
