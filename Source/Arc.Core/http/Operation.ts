// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { CommandResult, DescriptorBase, ExecutionContext, QueryOptions, QueryResult } from '../index.js';

export interface Operation extends DescriptorBase {
    readonly kind: 'command' | 'query';
    readonly route: string;
    readonly inputSchema: Record<string, unknown>;
    readonly dynamicAuthorization?: boolean;
    /** Built-in endpoints are served and documented, but not emitted as application client proxies. */
    readonly internal?: boolean;
    readonly schema: z.ZodType;
    run(input: unknown, context: ExecutionContext, options?: QueryOptions, validateOnly?: boolean): Promise<CommandResult | QueryResult>;
}
