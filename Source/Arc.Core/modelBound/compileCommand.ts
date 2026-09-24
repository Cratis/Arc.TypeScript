// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { CommandDefinition } from '../commands/CommandDefinition.js';
import type { ServiceIdentifier } from '../dependencyInjection/ServiceIdentifier.js';
import { isOutcome, response } from '../results/Outcome.js';
import { reflectedParameters, resolveAll } from './dependencies.js';
import { ownMetadata, type ClassType, type WireType } from './metadata.js';
import { decode, encode, objectSchema } from './wireSchema.js';

export interface CompiledCommand {
    readonly definition: CommandDefinition<z.ZodType, unknown>;
    readonly dependencies: readonly ServiceIdentifier<unknown>[];
}
export function compileCommand(type: ClassType, namespace: string): CompiledCommand {
    const metadata = ownMetadata(type);
    if (!metadata.command) throw new Error(`Not an Arc command: ${type.name}`);
    const prototype = type.prototype as { handle?: (...parameters: unknown[]) => unknown; provide?: () => unknown };
    if (typeof prototype.handle !== 'function') throw new Error(`Command ${type.name} requires handle()`);
    const hasProvider = typeof prototype.provide === 'function';
    const count = prototype.handle.length - Number(hasProvider);
    if (count < 0) throw new Error(`Invalid handle parameters on ${type.name}`);
    let tokens = metadata.injected ?? [];
    if (metadata.injectionDeclared && !tokens.length && count) tokens = reflectedParameters(type.prototype, 'handle', count, Number(hasProvider));
    if (tokens.length !== count) throw new Error(`Unbound handle parameters on ${type.name}.handle`);
    const schema = objectSchema(type as WireType);
    const definition: CommandDefinition<typeof schema, unknown> = {
        name: type.name, namespace: metadata.namespace ?? namespace, path: metadata.path, schema,
        authorization: metadata.authorization, wireInputSchema: z.toJSONSchema(schema, { io: 'input' }),
        handlerDependencies: tokens,
        provide: hasProvider ? async input => {
            const instance = decode(type as WireType, input) as { provide(): unknown };
            const value = await instance.provide();
            if (isOutcome(value)) return value.kind === 'response' ? { instance, value: value.value } : value;
            return { instance, value };
        } : undefined,
        handle: async (input, _context, provided) => {
            const preparation = provided as { instance: { handle(...parameters: unknown[]): unknown }; value: unknown } | undefined;
            const instance = hasProvider ? preparation!.instance : decode(type as WireType, input) as { handle(...parameters: unknown[]): unknown };
            const services = await resolveAll(tokens);
            const result = await instance.handle(...(hasProvider ? [preparation!.value] : []), ...services);
            if (isOutcome(result)) return result.kind === 'response' ? response(encode(result.value)) : result;
            return encode(result);
        }
    };
    return { definition, dependencies: tokens };
}
