// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { CommandDefinition } from '../CommandDefinition.js';
import { isOutcome } from '../../results/Outcome.js';
import { reflectedParameters } from '../../reflection/reflectedParameters.js';
import { commandServiceTokens, resolveCommandArguments } from './commandArgument.js';
import { encodeCommandResponse } from './encodeCommandResponse.js';
import { providedType } from './provided.js';
import { ownMetadata } from '../../reflection/ownMetadata.js';
import type { ClassType } from '../../reflection/ClassType.js';
import type { WireType } from '../../reflection/WireType.js';
import { decode, objectSchema } from '../../reflection/wireSchema.js';
import type { ModelGraphValidator } from '../../validation/ModelGraphValidator.js';
import type { CompiledCommand } from './CompiledCommand.js';
/** Compile a decorated command onto the existing Arc command pipeline. */
export function compileCommand(type: ClassType, namespace: string, graph?: ModelGraphValidator): CompiledCommand {
    const metadata = ownMetadata(type);
    if (!metadata.command) throw new Error(`Not an Arc command: ${type.name}`);
    const prototype = type.prototype as { handle?: (...parameters: unknown[]) => unknown; provide?: (...parameters: unknown[]) => unknown };
    if (typeof prototype.handle !== 'function') throw new Error(`Command ${type.name} requires handle()`);
    const hasProvider = typeof prototype.provide === 'function';
    let tokens = metadata.injected?.get('handle') ?? [];
    const typedPreparation = tokens.some(token => !!providedType(token));
    if (typedPreparation && !hasProvider) throw new Error(`Command ${type.name} uses provided() without provide()`);
    const count = prototype.handle.length - Number(hasProvider && !typedPreparation);
    if (count < 0) throw new Error(`Invalid handle parameters on ${type.name}`);
    if (metadata.injected?.has('handle') && !tokens.length && count) {
        tokens = reflectedParameters(type.prototype, 'handle', count, Number(hasProvider));
    }
    if (tokens.length !== count) throw new Error(`Unbound handle parameters on ${type.name}.handle`);
    const provideCount = hasProvider ? prototype.provide!.length : 0;
    let provideTokens = metadata.injected?.get('provide') ?? [];
    if (hasProvider && metadata.injected?.has('provide') && !provideTokens.length && provideCount)
        provideTokens = reflectedParameters(type.prototype, 'provide', provideCount, 0);
    if (provideTokens.length !== provideCount) throw new Error(`Unbound provide parameters on ${type.name}.provide`);
    const schema = objectSchema(type as WireType);
    const definition: CommandDefinition<typeof schema, unknown> = {
        name: type.name, namespace: metadata.namespace ?? namespace, path: metadata.path, schema,
        commandFactory: input => decode(type as WireType, input),
        authorization: metadata.authorization, wireInputSchema: z.toJSONSchema(schema, { io: 'input' }),
        handlerDependencies: commandServiceTokens([...tokens, ...provideTokens]),
        validate: graph ? async (input, context) =>
            graph.validate(decode(type as WireType, input), context.signal, '', context.correlationId) : undefined,
        provide: hasProvider ? async (_input, context) => {
            const instance = (context as import('../CommandContext.js').CommandContext).command as { provide(...parameters: unknown[]): unknown };
            const value = await instance.provide(...await resolveCommandArguments(provideTokens, context as import('../CommandContext.js').CommandContext));
            if (isOutcome(value)) return value.kind === 'response' ? { instance, value: value.value } : value;
            return { instance, value };
        } : undefined,
        handle: async (_input, context, provided) => {
            const preparation = provided as { instance: { handle(...parameters: unknown[]): unknown }; value: unknown } | undefined;
            const instance = hasProvider ? preparation!.instance :
                (context as import('../CommandContext.js').CommandContext).command as { handle(...parameters: unknown[]): unknown };
            const services = await resolveCommandArguments(tokens, context as import('../CommandContext.js').CommandContext, preparation?.value);
            const result = await instance.handle(...(hasProvider && !typedPreparation ? [preparation!.value] : []), ...services);
            return encodeCommandResponse(result);
        }
    };
    return { definition, dependencies: commandServiceTokens([...tokens, ...provideTokens]) };
}
