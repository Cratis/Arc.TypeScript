// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import type { ServiceIdentifier } from '../../dependencyInjection/ServiceIdentifier.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import type { CommandContext } from '../CommandContext.js';
import { flattenCommandResponse } from '../processCommandResponse.js';
import { providedType } from './provided.js';
const signalToken = serviceToken<AbortSignal>('Arc command signal');
const contextToken = serviceToken<CommandContext>('Arc command context');
/** Explicit AbortSignal parameter marker for @inject on handle() or provide(). */
export function signal(): typeof signalToken { return signalToken; }
/** Explicit CommandContext parameter marker for @inject on handle() or provide(). */
export function context(): typeof contextToken { return contextToken; }
/** Resolve service tokens alongside built-in command arguments. */
export async function resolveCommandArguments(tokens: readonly ServiceIdentifier<unknown>[], command: CommandContext,
    provided: unknown = undefined): Promise<unknown[]> {
    const candidates = flattenCommandResponse(provided);
    const values: unknown[] = [];
    for (const token of tokens) {
        if (token === signalToken) { values.push(command.signal); continue; }
        if (token === contextToken) { values.push(command); continue; }
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
    return tokens.filter(token => token !== signalToken && token !== contextToken && !providedType(token));
}
