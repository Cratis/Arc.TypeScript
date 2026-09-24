// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import type { CommandOperationFailure } from './CommandOperationFailure.js';
/** Extend this server-only declaration; dependencies are resolved before any operation starts. */
export abstract class CommandOperation {
    readonly executeDependencies?: readonly ServiceIdentifier<unknown>[];
    readonly compensateDependencies?: readonly ServiceIdentifier<unknown>[];
    abstract execute(signal: AbortSignal, ...dependencies: unknown[]): void | Promise<void>;
    compensate?(failure: CommandOperationFailure, signal: AbortSignal, ...dependencies: unknown[]): void | Promise<void>;
}
