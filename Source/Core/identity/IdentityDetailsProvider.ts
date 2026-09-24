// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { z } from 'zod';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { Principal } from './Principal.js';
import type { WireType } from '../reflection/WireType.js';
/** Returning undefined denies the authenticated caller. Details must match schema. */
export interface IdentityDetailsProvider {
    /** Explicit Zod schema, or use detailsType to derive one from @field declarations. */
    readonly schema?: z.ZodType;
    readonly detailsType?: WireType;
    readonly provide: (principal: Principal, context: ExecutionContext) => unknown | Promise<unknown>;
}
