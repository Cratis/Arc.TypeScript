// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import type { ServiceIdentifier } from '../../dependencyInjection/ServiceIdentifier.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import type { CommandContext } from '../CommandContext.js';
import { flattenCommandResponse } from '../processCommandResponse.js';
import { providedType } from './provided.js';
import { optionalServiceType } from '../../reflection/optionalService.js';
import { readModelArgument } from './readModel.js';
import { ReadModelForCommandError } from '../ReadModelForCommandError.js';
const signalToken = serviceToken<AbortSignal>('Arc command signal');
const contextToken = serviceToken<CommandContext>('Arc command context');
const readModels = new WeakMap<CommandContext, Map<object, unknown>>();
/** Explicit AbortSignal parameter marker for @inject on handle() or provide(). */
export function abortSignal(): typeof signalToken { return signalToken; }
/** Explicit CommandContext parameter marker for @inject on handle() or provide(). */
export function commandContext(): typeof contextToken { return contextToken; }
/** Resolve service tokens alongside built-in command arguments. */
export async function resolveCommandArguments(tokens: readonly ServiceIdentifier<unknown>[], command: CommandContext,
    provided: unknown = undefined): Promise<unknown[]> {
    const candidates = flattenCommandResponse(provided);
    const values: unknown[] = [];
    for (const token of tokens) {
        if (token === signalToken) { values.push(command.signal); continue; }
        if (token === contextToken) { values.push(command); continue; }
        const model = readModelArgument(token);
        if (model) {
            const resolvers = await Promise.all((command.readModelResolvers ?? []).map(item => currentServices().resolve(item)));
            const matching = resolvers.filter(resolver => resolver.supports(model.type));
            if (matching.length !== 1) throw new Error(`Expected one read-model resolver for ${model.type.name}, found ${matching.length}`);
            if (!command.key?.trim()) throw new ReadModelForCommandError(`A command key is required for ${model.type.name}`);
            let cached = readModels.get(command);
            if (!cached) { cached = new Map(); readModels.set(command, cached); }
            if (!cached.has(model.type)) cached.set(model.type, await matching[0]!.find(model.type, command.key, command));
            const found = cached.get(model.type);
            if (found === undefined) throw new Error(`Read-model resolver returned no outcome for ${model.type.name}`);
            if (found === null && !model.optional) throw new ReadModelForCommandError(`${model.type.name} was not found for the command key`);
            values.push(found);
            continue;
        }
        const optional = optionalServiceType(token);
        if (optional) {
            const scope = currentServices();
            values.push(scope.registry.hasRegistration(optional) ? await scope.resolve(optional) : null);
            continue;
        }
        const type = providedType(token);
        if (!type) { values.push(await currentServices().resolve(token)); continue; }
        const index = candidates.findIndex(candidate => candidate instanceof type ||
            type === String && typeof candidate === 'string' || type === Number && typeof candidate === 'number' ||
            type === Boolean && typeof candidate === 'boolean');
        if (index < 0) throw new Error(`No provided value matches ${type.name}`);
        values.push(candidates.splice(index, 1)[0]);
    }
    return values;
}
/** Service tokens alone participate in DI preflight. */
export function commandServiceTokens(tokens: readonly ServiceIdentifier<unknown>[]): ServiceIdentifier<unknown>[] {
    return tokens.filter(token => token !== signalToken && token !== contextToken && !providedType(token) &&
        !readModelArgument(token) && !optionalServiceType(token));
}
