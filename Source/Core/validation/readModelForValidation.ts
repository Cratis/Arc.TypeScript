// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { CommandContext } from '../commands/CommandContext.js';
import { commandReadModel } from '../commands/modelBound/commandReadModel.js';
import { ReadModelForCommandError } from '../commands/ReadModelForCommandError.js';
import { resolveCommandArguments } from '../commands/modelBound/commandContextArgument.js';
import type { ClassType } from '../reflection/ClassType.js';

const current = new AsyncLocalStorage<CommandContext>();
/** Bind read-model lookups in validation predicates to the trusted command key and namespace. */
export function withCommandValidationContext<T>(context: CommandContext, action: () => T): T {
    return current.run(context, action);
}
/** Read a command-keyed model inside an asynchronous command validator predicate. */
export function readModelForValidation<T>(type: ClassType<T>): Promise<T>;
export function readModelForValidation<T>(type: ClassType<T>, options: { optional: true }): Promise<T | null>;
export async function readModelForValidation<T>(type: ClassType<T>, options?: { optional: true }): Promise<T | null> {
    const context = current.getStore();
    if (!context) throw new Error('Command read models can only be resolved during command validation');
    const [value] = await resolveCommandArguments([commandReadModel(type, { optional: true })], context);
    if (value === null && !options?.optional) throw new ReadModelForCommandError(`${type.name} was not found for the command key`);
    return value as T | null;
}
