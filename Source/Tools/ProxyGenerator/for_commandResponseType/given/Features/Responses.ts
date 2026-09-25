// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, CommandOperation, CommandOperations, denied, rejected, response, tuple, validation } from '@cratis/arc.core';
import type { Outcome } from '@cratis/arc.core';
import { eventType as chronicleEvent } from '@cratis/chronicle/events';
import {
    eventForEventSourceId, eventSourceIdResponse, eventsWithConcurrencyScopes, AggregateRootCommitResult
} from '../../../../../Chronicle/index.js';
import type { RoutedEvent } from '../../../../../Chronicle/eventForEventSourceId.js';

function eventType() { return (target: unknown, context: ClassDecoratorContext) => { void target; void context; }; }
@chronicleEvent() class Registered { name = ''; }
@eventType() export class Plain { name = ''; }
class Save extends CommandOperation { execute(): void {} }
@command() export class JustEvent { handle(): Registered { return new Registered(); } }
@command() export class AsyncEvents { async handle(): Promise<Registered[]> { return [new Registered()]; } }
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
