// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import type { CommandOperationFailure } from './CommandOperationFailure.js';
const brand = Symbol.for('@cratis/arc.core/CommandOperation');
/** Recognize declarations across independently loaded copies of the package. */
export function isCommandOperation(value: unknown): value is CommandOperation {
    return !!value && typeof value === 'object' && Reflect.get(value, brand) === true;
}
/** Extend this server-only declaration; dependencies are resolved before any operation starts. */
export abstract class CommandOperation {
    readonly [brand] = true;
    readonly executeDependencies?: readonly ServiceIdentifier<unknown>[];
    readonly compensateDependencies?: readonly ServiceIdentifier<unknown>[];
    abstract execute(signal: AbortSignal, ...dependencies: unknown[]): void | Promise<void>;
    compensate?(failure: CommandOperationFailure, signal: AbortSignal, ...dependencies: unknown[]): void | Promise<void>;
}
