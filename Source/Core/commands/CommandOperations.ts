// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandOperation } from './CommandOperationDeclaration.js';
const brand = Symbol.for('@cratis/arc.core/command-operations');
/** Immutable, explicit batch of server-only operation declarations. */
export class CommandOperations {
    readonly [brand] = true;
    readonly values: readonly CommandOperation[];
    constructor(operations: readonly CommandOperation[]) {
        if (operations.some(operation => !operation)) throw new Error('CommandOperations cannot contain null operations');
        this.values = Object.freeze([...operations]);
    }
}
/** Recognize a batch without treating ordinary arrays as operations. */
export function isCommandOperations(value: unknown): value is CommandOperations {
    return !!value && typeof value === 'object' && Reflect.get(value, brand) === true && Array.isArray(Reflect.get(value, 'values'));
}
/** Create a command operation batch from declarations. */
export function operations(...values: CommandOperation[]): CommandOperations { return new CommandOperations(values); }
