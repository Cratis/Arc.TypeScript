// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { QueryDefinition } from './QueryDefinition.js';

export function defineQuery<S extends z.ZodType, T>(definition: QueryDefinition<S, T>): QueryDefinition<S, T> { return definition; }
