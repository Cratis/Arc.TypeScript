// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { AuthenticationHandler, CommandDefinition, Principal, QueryDefinition } from './contracts.js';
export interface ArcServerOptions {
    commands?: readonly CommandDefinition<z.ZodType, unknown>[];
    queries?: readonly QueryDefinition<z.ZodType, unknown>[];
    prefix?: string;
    segmentsToSkip?: number;
    enableQueryMethod?: boolean;
    maxBodyBytes?: number;
    correlationHeader?: string;
    tenantHeader?: string;
    resolveTenant?: (request: Request, principal: Principal | undefined) => string | undefined | Promise<string | undefined>;
    authentication?: readonly AuthenticationHandler[];
    development?: boolean;
    logger?: (error: unknown, correlationId: string) => void;
    identityDetailsSchema?: Record<string, unknown>;
}
