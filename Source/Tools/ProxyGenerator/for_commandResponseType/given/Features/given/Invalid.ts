// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandOperation, tuple } from '@cratis/arc.core';
class Save extends CommandOperation { execute(): void {} }
export class TooMany { handle() { return tuple('first', 2); } }
export class BareOperations { handle(): Save[] { return [new Save()]; } }
