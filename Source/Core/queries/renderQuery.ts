// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcOptions } from '../ArcOptions.js';
import type { DescriptorBase } from '../http/DescriptorBase.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import { currentServices } from '../dependencyInjection/ServiceScope.js';
import { throwIfCanceled } from '../execution/throwIfCanceled.js';
import { encode, fieldsFor, wireName } from '../reflection/wireSchema.js';
import type { WireType } from '../reflection/WireType.js';
import { assertClientOutput } from '../introspection/ClientManifest.js';
import { isQueryPage, queryPage } from './QueryPage.js';
import type { QueryOptions } from './QueryOptions.js';
import type { QueryResult } from './QueryResult.js';
import { renderQueryData } from './queryRendering.js';
import type { ReadModelInterceptor } from './ReadModelInterceptor.js';

/** Run provider rendering and exact-type interception inside the current query scope, for every emission. */
export async function renderQuery(definition: Pick<DescriptorBase, 'clientOutput'> & { wireOutput?: boolean; wireType?: WireType }, data: unknown,
    context: ExecutionContext, options: QueryOptions = {}, settings: ArcOptions = {}): Promise<QueryResult> {
    const scope = currentServices();
    throwIfCanceled(context, 'Query canceled');
    for (const token of settings.queryRenderers ?? []) {
        throwIfCanceled(context, 'Query canceled');
        const renderer = await scope.resolve(token);
        throwIfCanceled(context, 'Query canceled');
        const canRender = await renderer.canRender(data);
        throwIfCanceled(context, 'Query canceled');
        if (canRender) {
            data = await renderer.render(data, context, options);
            throwIfCanceled(context, 'Query canceled');
            break;
        }
    }
    throwIfCanceled(context, 'Query canceled');
    if (!settings.readModelInterceptors?.length)
        return renderQueryData(definition, definition.wireOutput ? encode(data, definition.wireType, definition.wireType) : data, context, options);
    const interceptors: ReadModelInterceptor[] = [];
    for (const token of settings.readModelInterceptors) {
        throwIfCanceled(context, 'Query canceled');
        interceptors.push(await scope.resolve(token));
        throwIfCanceled(context, 'Query canceled');
    }
    const field = definition.wireType && options.sorting ? fieldsFor(definition.wireType)
        .find(candidate => wireName(candidate.name) === options.sorting?.field) : undefined;
    const rawOptions = field && options.sorting ? { ...options, sorting: { ...options.sorting, field: field.name } } : options;
    const page = Array.isArray(data) ? renderQueryData({ clientOutput: undefined }, data, context, rawOptions) : undefined;
    throwIfCanceled(context, 'Query canceled');
    if (page && !page.isSuccess) return page;
    if (page) data = page.data;
    const intercept = async (item: unknown): Promise<unknown> => {
        throwIfCanceled(context, 'Query canceled');
        if (item === null || typeof item !== 'object') return item;
        for (const handler of interceptors) {
            throwIfCanceled(context, 'Query canceled');
            if (item && typeof item === 'object' && item.constructor === handler.model) {
                item = await handler.intercept(item);
                throwIfCanceled(context, 'Query canceled');
            }
        }
        return item;
    };
    if (isQueryPage(data)) {
        const items = [];
        for (const item of data.items) items.push(await intercept(item));
        data = queryPage(items, data.totalItems, data.sorting);
    } else if (Array.isArray(data)) {
        const items = [];
        for (const item of data) items.push(await intercept(item));
        data = items;
    } else data = await intercept(data);
    throwIfCanceled(context, 'Query canceled');
    if (page) {
        const output = definition.wireOutput ? encode(data, definition.wireType, definition.wireType) : data;
        throwIfCanceled(context, 'Query canceled');
        return { ...page, data: definition.clientOutput ? assertClientOutput(definition.clientOutput.output, output) : output };
    }
    return renderQueryData(definition, definition.wireOutput ? encode(data, definition.wireType, definition.wireType) : data, context, options);
}
