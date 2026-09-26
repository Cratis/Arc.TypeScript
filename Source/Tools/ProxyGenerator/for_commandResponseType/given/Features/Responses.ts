// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, field } from '@cratis/fundamentals';
import { command, CommandOperation, CommandOperations, denied, rejected, response, tuple, validation } from '@cratis/arc.core';
import type { ArcTuple, Outcome } from '@cratis/arc.core';
import { eventType as chronicleEvent } from '@cratis/chronicle/events';
import {
    eventForEventSourceId, eventSourceIdResponse, eventsWithConcurrencyScopes, AggregateRootCommitResult
} from '../../../../../Chronicle/index.js';
import type { RoutedEvent } from '../../../../../Chronicle/eventForEventSourceId.js';

function eventType() { return (target: unknown, context: ClassDecoratorContext) => { void target; void context; }; }
@chronicleEvent() class Registered { name = ''; }
@chronicleEvent() class Removed { name = ''; }
@eventType() export class Plain { name = ''; }
class Save extends CommandOperation { execute(): void {} }
@command() export class JustEvent { handle(): Registered { return new Registered(); } }
@command() export class AsyncEvents { async handle(): Promise<Registered[]> { return [new Registered()]; } }
@command() export class MixedEvents { handle(): (Registered | Removed)[] { return [new Registered(), new Removed()]; } }
@command() export class MixedEventsAndOperation {
    handle() { return tuple([new Registered(), new Removed()] as (Registered | Removed)[], new Save()); }
}
@command() export class JustOperation { handle(): CommandOperations { return new CommandOperations([new Save()]); } }
@command() export class Operation { handle(): Save { return new Save(); } }
@command() export class Routed { handle(): RoutedEvent { return eventForEventSourceId({ eventSourceId: 'id', event: new Registered() }); } }
@command() export class Scoped { handle() { return eventsWithConcurrencyScopes([new Registered()], {}); } }
@command() export class Committed { handle(): AggregateRootCommitResult { throw new Error('not invoked'); } }
@command() export class WithId { handle() { return tuple(eventSourceIdResponse('id'), new Registered()); } }
@command() export class WithResponse { handle() { return tuple(new Registered(), 'visible'); } }
@command() export class EventOrResponse { handle(): Registered | string { return 'visible'; } }
@command() export class EventOrNothing { handle(): Registered | undefined { return undefined; } }
@command() export class PlainResult { handle(): Plain { return new Plain(); } }
@command() export class PlainArray { handle(): string[] { return ['visible']; } }
@command() export class Rejection { handle() { return rejected(validation('Invalid')); } }
@command() export class Denial { handle() { return denied('Not allowed'); } }
@command() export class EventOrRejection {
    handle(): Registered | Outcome<never> { return rejected(validation('Invalid')); }
}
@command() export class AsyncEventOrRejection {
    async handle(): Promise<Registered | Outcome<never>> { return new Registered(); }
}
@command() export class TupleWithRejection {
    handle() { return tuple(new Registered(), rejected(validation('Invalid')), 'visible'); }
}
@command() export class WrappedResponse { handle(): Outcome<string> { return response('visible'); } }
@command() export class AsyncWrappedResponse {
    async handle(): Promise<Outcome<string>> { return response('visible'); }
}
@command() export class WrappedEvent { handle(): Outcome<Registered> { return response(new Registered()); } }
@command() export class EventOrDenial { handle(): Registered | Outcome<never> { return denied('Not allowed'); } }
@command() export class VoidOutcome { handle(): Outcome<void> { return response(undefined); } }
@command() export class NestedOutcome { handle(): Outcome<Outcome<string>> { return response(response('visible')); } }
@command() export class TupleOutcome { handle(): Outcome<ArcTuple<readonly [Registered, string]>> {
    return response(tuple(new Registered(), 'visible'));
} }
@command() export class PlainArrayOrRejection {
    @field(Boolean) reject = false;
    handle(): Plain[] | Outcome<never> { return this.reject ? rejected(validation('Invalid')) : [new Plain(), new Plain()]; }
}
@command() export class AsyncPlainArrayOrRejection {
    @field(Boolean) reject = false;
    async handle(): Promise<Plain[] | Outcome<never>> { return this.reject ? rejected(validation('Invalid')) : [new Plain()]; }
}
@command() export class EventArrayOrRejection {
    handle(): Registered[] | Outcome<never> { return rejected(validation('Invalid')); }
}

type AliasedOutcome = Outcome<Plain>;
@command() export class AliasedResponse {
    @field(Boolean) wrapped = false;
    handle(): AliasedOutcome | Plain { return this.wrapped ? response(new Plain()) : new Plain(); }
}
@command() export class AwaitedAlternative {
    @field(Boolean) later = false;
    handle(): Plain | Promise<Plain> { return this.later ? Promise.resolve(new Plain()) : new Plain(); }
}
@command() export class TupleAlternatives {
    @field(Boolean) wrapped = false;
    handle(): Outcome<ArcTuple<readonly [Registered, Plain]>> | Plain {
        return this.wrapped ? response(tuple(new Registered(), new Plain())) : new Plain();
    }
}
@command() export class NestedTupleAlternative {
    handle(): ArcTuple<readonly [Registered, ArcTuple<readonly [Registered, Plain]>]> | Outcome<Plain> {
        return response(new Plain());
    }
}
@command() export class ArrayAlternatives {
    @field(Boolean) wrapped = false;
    handle(): Plain[] | Outcome<Plain[]> { return this.wrapped ? response([new Plain()]) : [new Plain()]; }
}
@command() export class SamePrimitivePaths {
    @field(Boolean) wrapped = false;
    handle(): Outcome<string> | string { return this.wrapped ? response('visible') : 'visible'; }
}
export enum Color { Red = 1, Blue = 2 }
@command() export class BooleanResult { handle(): boolean { return true; } }
@command() export class ColorResult { handle(): Color { return Color.Blue; } }
@command() export class LiteralResult { handle(): 'created' | 'existing' { return 'created'; } }
@command() export class WrappedBooleanResult { handle(): Outcome<boolean> { return response(true); } }
export class TaskId extends ConceptAs<string> { static readonly valueType = String; }
export class UserId extends ConceptAs<string> { static readonly valueType = String; }
@command() export class DistinctConcepts { handle(): TaskId | UserId { return new TaskId('task'); } }
export class Date { @field(String) value = ''; }
@command() export class NamedDate { handle(): Date { return new Date(); } }
