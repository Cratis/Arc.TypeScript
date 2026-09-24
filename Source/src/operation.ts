// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { CommandResult, DescriptorBase, ExecutionContext, QueryOptions, QueryResult } from './contracts.js';

export interface Operation extends DescriptorBase {
    readonly kind: 'command' | 'query';
    readonly route: string;
    readonly inputSchema: Record<string, unknown>;
    readonly schema: z.ZodType;
    run(input: unknown, context: ExecutionContext, options?: QueryOptions, validateOnly?: boolean): Promise<CommandResult | QueryResult>;
}
