// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandOperation, response, tuple } from '@cratis/arc.core';
import type { Outcome } from '@cratis/arc.core';
class Save extends CommandOperation { execute(): void {} }
export class TooMany { handle() { return tuple('first', 2); } }
export class BareOperations { handle(): Save[] { return [new Save()]; } }
class Created { value = ''; }
class Existing { value = ''; }
export class DifferentDecoders { handle(): Outcome<Created | Existing> { return response(new Created()); } }
export class DifferentCardinality { handle(): Created | Created[] { return new Created(); } }
export class FakeOutcome { handle() { return { kind: 'response' as const, value: new Created() }; } }
