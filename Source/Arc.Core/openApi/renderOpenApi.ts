// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Operation } from '../http/Operation.js';
import { isObservableOperation } from '../queries/observable/ObservableOperation.js';

export function renderOpenApi(commands: readonly Operation[], queries: readonly Operation[]): Record<string, unknown> {
        const paths: Record<string, unknown> = {};
        for (const operation of [...commands, ...queries]) {
            const method = operation.kind === 'command' ? 'post' : 'get';
            paths[operation.route] = { [method]: {
                operationId: [operation.namespace, operation.name].filter(Boolean).join('.'), summary: operation.summary ?? '',
                ...(operation.kind === 'command' ? { requestBody: { required: true, content: { 'application/json': { schema: operation.inputSchema } } } } : {
                    parameters: Object.entries(operation.inputSchema.properties as Record<string, unknown> ?? {}).map(([name, schema]) => ({ name, in: 'query', required: (operation.inputSchema.required as string[] ?? []).includes(name), schema }))
                }), responses: { '200': { description: isObservableOperation(operation) ? 'Snapshot or direct SSE stream' : 'Result',
                    ...(isObservableOperation(operation) ? { content: { 'text/event-stream': { schema: { type: 'string' } } } } : {}) },
                    ...(isObservableOperation(operation) ? {
                        '202': { description: 'No current value' }, '408': { description: 'First-result wait timed out' },
                        '503': { description: 'Subscription limit reached' }
                    } : {}),
                    '400': { description: 'Invalid request' }, '403': { description: 'Not authorized' },
                    '500': { description: 'Server error' } }
            } };
        }
        return { openapi: '3.1.0', info: { title: 'Arc', version: '0.1.0' }, paths };
    }
