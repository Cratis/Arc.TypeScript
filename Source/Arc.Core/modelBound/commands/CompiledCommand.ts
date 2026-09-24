// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { CommandDefinition } from '../../commands/CommandDefinition.js';
import type { ServiceIdentifier } from '../../dependencyInjection/ServiceIdentifier.js';
/** Executable command definition and its injected service dependencies. */
export interface CompiledCommand {
    readonly definition: CommandDefinition<z.ZodType, unknown>;
    readonly dependencies: readonly ServiceIdentifier<unknown>[];
}
