// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { ArcOptions } from '../ArcOptions.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { CommandDefinition } from './CommandDefinition.js';
import type { CommandResult } from './CommandResult.js';
import { authorized } from '../authorization/authorized.js';
import { commandResult } from './createCommandResult.js';
import { malformed } from '../http/malformed.js';
import type { Operation } from '../http/Operation.js';
import { ClientOperationKind } from '../introspection/ClientOperationKind.js';
import { fullyQualifiedName } from '../http/fullyQualifiedName.js';
import { createCommandContext } from './createCommandContext.js';
import { CommandContextValues } from './CommandContextValues.js';
import { commandFailure, executeCommandOperation } from './executeCommandOperation.js';
import { runCommandFilters } from './runCommandFilters.js';
import type { CommandContext } from './CommandContext.js';
import { withOperationName } from '../execution/withOperationName.js';

enum CommandOperationMode { Execute, Validate }

/** Compile a command into the shared direct and HTTP execution pipeline. */
export function commandOperation<S extends z.ZodType, T>(definition: CommandDefinition<S, T>, route: string,
    options: ArcOptions = {}): Operation {
    const operationName = fullyQualifiedName(definition);
    const invoke = async (input: unknown, execution: ExecutionContext, mode: CommandOperationMode): Promise<CommandResult> => {
        if (!await authorized(definition.authorization, execution, options.authorizationPolicies ?? {}, definition, input))
            return commandResult(execution, { isAuthorized: false });
        const parsed = definition.schema.safeParse(input);
        if (parsed.success) {
            try {
                if (definition.authorize && !await definition.authorize(parsed.data, execution))
                    return commandResult(execution, { isAuthorized: false });
            } catch (error) {
                return commandFailure(withOperationName({ ...execution, command: parsed.data, key: undefined,
                    values: new CommandContextValues() }, operationName), error);
            }
        }
        const minimalContext: CommandContext = withOperationName({ ...execution, command: input, key: undefined,
            values: new CommandContextValues(), readModelResolvers: options.readModelForCommandResolvers }, operationName);
        let context: CommandContext = minimalContext;
        if (parsed.success) {
            try { context = withOperationName(
                await createCommandContext(definition.commandFactory?.(parsed.data) ?? parsed.data, execution, options), operationName); }
            catch (error) { return commandFailure(minimalContext, error); }
        }
        const authorization = await runCommandFilters(context, options, true);
        if (!authorization.result.isSuccess) return authorization.result;
        if (!parsed.success) return commandResult(execution, { validationResults: malformed(execution) });
        if (!authorization.blocked) {
            const filtered = await runCommandFilters(context, options, false);
            if (!filtered.result.isSuccess) return filtered.result;
        }
        if (context.signal.aborted) return commandFailure(context, context.signal.reason ?? new Error('Command canceled'));
        const execute = () => executeCommandOperation(definition, parsed.data, context, options, mode === CommandOperationMode.Validate);
        return options.commandExecutionRunner ? options.commandExecutionRunner(context, execute) : execute();
    };
    return {
        ...definition, kind: ClientOperationKind.Command, route, fullyQualifiedName: operationName,
        dynamicAuthorization: typeof definition.authorize === 'function',
        inputSchema: definition.wireInputSchema ?? z.toJSONSchema(definition.schema),
        run: (input, execution) => invoke(input, execution, CommandOperationMode.Execute),
        validateCommand: (input, execution) => invoke(input, execution, CommandOperationMode.Validate)
    };
}
