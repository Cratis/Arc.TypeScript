// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { SortDirection } from './SortDirection.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import type { DescriptorBase } from '../http/DescriptorBase.js';
import type { QueryOptions } from './QueryOptions.js';
import type { QueryResult } from './QueryResult.js';
import { isQueryPage } from './QueryPage.js';
import { assertClientOutput } from '../introspection/ClientManifest.js';
import { emptyPaging } from './emptyPaging.js';
import { malformed } from '../http/malformed.js';
import { queryResult } from './createQueryResult.js';

function compareValues(left: unknown, right: unknown): number {
    if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
    if (left == null || right == null) return left == null ? right == null ? 0 : -1 : 1;
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    if (typeof left === 'bigint' && typeof right === 'bigint') return left < right ? -1 : left > right ? 1 : 0;
    if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right);
    return String(left).localeCompare(String(right));
}

/** Shape one already-authorized query result without rerunning user authorization or validation. */
export function renderQueryData<T>(definition: Pick<DescriptorBase, 'clientOutput'>, data: T,
    context: ExecutionContext, options: QueryOptions = {}): QueryResult {
    if (isQueryPage(data)) {
        const items = definition.clientOutput ? assertClientOutput(definition.clientOutput.output, data.items) as typeof data.items : data.items;
        const page = options.paging?.page ?? 0;
        const size = options.paging?.pageSize ?? 0;
        if (options.sorting && (data.sorting?.field !== options.sorting.field || data.sorting.direction !== options.sorting.direction) ||
            (!size && items.length !== data.totalItems) ||
            size && items.length !== Math.min(size, Math.max(0, data.totalItems - page * size)))
            return queryResult(context, { validationResults: malformed(context) });
        return queryResult(context, { data: items, paging: size ? {
            page, size, totalItems: data.totalItems, totalPages: Math.ceil(data.totalItems / size)
        } : emptyPaging() });
    }
    if (Array.isArray(data)) {
        const wire = definition.clientOutput ? assertClientOutput(definition.clientOutput.output, data) as typeof data : data;
        const sorted = [...wire];
        if (options.sorting) {
            const { field, direction } = options.sorting;
            if (sorted.some((item: unknown) => !item || typeof item !== 'object' || !Object.hasOwn(item, field)))
                return queryResult(context, { validationResults: malformed(context) });
            sorted.sort((left: unknown, right: unknown) => {
                const first = left && typeof left === 'object' ? Reflect.get(left, field) as unknown : undefined;
                const second = right && typeof right === 'object' ? Reflect.get(right, field) as unknown : undefined;
                const comparison = compareValues(first, second);
                return direction === SortDirection.Ascending ? comparison : -comparison;
            });
        }
        const page = options.paging?.page ?? 0;
        const size = options.paging?.pageSize ?? 0;
        const paging = size ? {
            page, size, totalItems: sorted.length, totalPages: Math.ceil(sorted.length / size)
        } : emptyPaging();
        return queryResult(context, { data: (size ? sorted.slice(page * size, (page + 1) * size) : sorted) as T, paging });
    }
    if (options.paging || options.sorting) return queryResult(context, { validationResults: malformed(context) });
    const wire = definition.clientOutput ? assertClientOutput(definition.clientOutput.output, data) : data;
    return queryResult(context, { data: wire });
}
