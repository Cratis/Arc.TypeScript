// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { Operation } from '../http/Operation.js';
import { schemaFor } from '../reflection/wireSchema.js';

const validationResult = { type: 'object', properties: {
    severity: { type: 'integer' }, message: { type: 'string' }, members: { type: 'array', items: { type: 'string' } },
    reason: { type: 'string' }
} };
const common = {
    correlationId: { type: 'string' }, isAuthorized: { type: 'boolean' },
    validationResults: { type: 'array', items: validationResult }, exceptionMessages: { type: 'array', items: { type: 'string' } },
    exceptionStackTrace: { type: 'string' }, isValid: { type: 'boolean' }, hasExceptions: { type: 'boolean' },
    isSuccess: { type: 'boolean' }
};
const paging = { type: 'object', properties: {
    page: { type: 'integer' }, size: { type: 'integer' }, totalItems: { type: 'integer' }, totalPages: { type: 'integer' }
}, required: ['page', 'size', 'totalItems', 'totalPages'] };

/** Describe only output types known at registration time; never guess a low-level handler's return type. */
export function resultSchema(operation: Operation): Record<string, unknown> {
    const result = operation.generatedReturn;
    const properties: Record<string, unknown> = { ...common };
    const required = [...Object.keys(common)];
    if (operation.kind === 'command') {
        properties.authorizationFailureReason = { type: 'string' };
        required.push('authorizationFailureReason');
    } else {
        properties.isReady = { type: 'boolean' };
        properties.paging = paging;
        required.push('isReady', 'paging');
    }
    if (result && result.cardinality !== 'void' && result.element) {
        const element = z.toJSONSchema(schemaFor(result.element), { io: 'output' });
        const value: Record<string, unknown> = result.cardinality === 'one' ? element : { type: 'array', items: element };
        properties[operation.kind === 'command' ? 'response' : 'data'] = result.nullable ?
            { anyOf: [value, { type: 'null' }] } : value;
    }
    return { type: 'object', properties, required };
}
