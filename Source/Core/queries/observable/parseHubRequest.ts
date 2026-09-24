// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BadRequest } from '../../http/BadRequest.js';
import { getQuery } from '../../http/queryBinding.js';
import type { Operation } from '../../http/Operation.js';
import type { QueryOptions } from '../QueryOptions.js';
import type { HubRequest } from './HubRequest.js';

/** Parse bounded untrusted hub payloads through the same GET query binder. */
export function parseHubRequest(value: unknown): HubRequest {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequest();
    const raw = value as Record<string, unknown>;
    const allowed = ['queryName', 'arguments', 'page', 'pageSize', 'sortBy', 'sortDirection', 'transferMode'];
    if (Object.keys(raw).some(key => !allowed.includes(key)))
        throw new BadRequest();
    if (typeof raw.queryName !== 'string' || raw.queryName.length > 180 ||
        !raw.queryName.split('.').every(part => /^[A-Za-z][A-Za-z0-9_]*$/.test(part))) throw new BadRequest();
    if (raw.arguments !== undefined && (!raw.arguments || typeof raw.arguments !== 'object' || Array.isArray(raw.arguments)))
        throw new BadRequest();
    const args = raw.arguments as Record<string, unknown> | undefined;
    if (args && (Object.keys(args).length > 128 || Object.entries(args).some(([key, argument]) =>
        key.length > 128 || !/^[A-Za-z][A-Za-z0-9_]*$/.test(key) ||
        argument !== null && (typeof argument !== 'string' || argument.length > 4096)))) throw new BadRequest();
    for (const key of ['page', 'pageSize']) {
        const number = raw[key];
        if (number !== undefined && (!Number.isSafeInteger(number) || (number as number) < 0 ||
            key === 'pageSize' && (number as number) > 1000)) throw new BadRequest();
    }
    for (const key of ['sortBy', 'sortDirection', 'transferMode']) {
        const argument = raw[key];
        if (argument !== undefined && (typeof argument !== 'string' || argument.length > 256)) throw new BadRequest();
    }
    return raw as unknown as HubRequest;
}

/** Resolve request arguments and paging for one registered query, without a separate binder. */
export function bindHubRequest(request: HubRequest, operation: Operation): { input: unknown; options: QueryOptions } {
    const url = new URL(operation.route, 'http://arc.invalid');
    for (const [key, value] of Object.entries(request.arguments ?? {})) {
        if (['page', 'pagesize', 'sortby', 'sortdirection', 'waitforfirstresult', 'waitforfirstresulttimeout'].includes(key.toLowerCase()))
            throw new BadRequest();
        if (value !== null) url.searchParams.set(key, value);
    }
    if (request.pageSize !== undefined) url.searchParams.set('pageSize', String(request.pageSize));
    if (request.page !== undefined) url.searchParams.set('page', String(request.page));
    if (request.sortBy !== undefined) url.searchParams.set('sortBy', request.sortBy);
    if (request.sortDirection !== undefined) url.searchParams.set('sortDirection', request.sortDirection);
    return getQuery(url, operation.schema, true);
}
