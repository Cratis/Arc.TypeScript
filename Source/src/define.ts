// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { CommandDefinition, QueryDefinition } from './contracts.js';

export function defineCommand<S extends z.ZodType, T>(definition: CommandDefinition<S, T>): CommandDefinition<S, T> { return definition; }
export function defineQuery<S extends z.ZodType, T>(definition: QueryDefinition<S, T>): QueryDefinition<S, T> { return definition; }
