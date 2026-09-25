// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { CommandResult } from '../commands/CommandResult.js';
import type { DescriptorBase } from '../DescriptorBase.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { QueryOptions } from '../queries/QueryOptions.js';
import type { QueryResult } from '../queries/QueryResult.js';

export interface Operation extends DescriptorBase {
    readonly kind: 'command' | 'query';
    readonly route: string;
    /** Namespace-qualified name used by direct execution and observable subscriptions. */
    readonly fullyQualifiedName: string;
    readonly inputSchema: Record<string, unknown>;
    readonly dynamicAuthorization?: boolean;
    /** Built-in endpoints are served and documented, but not emitted as application client proxies. */
    readonly internal?: boolean;
    readonly schema: z.ZodType;
    run(input: unknown, context: ExecutionContext, options?: QueryOptions, validateOnly?: boolean): Promise<CommandResult | QueryResult>;
}
