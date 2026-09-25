// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcOptions } from '../ArcOptions.js';
import type { DescriptorBase } from '../http/DescriptorBase.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import { currentServices } from '../dependencyInjection/ServiceScope.js';
import { encode, fieldsFor, wireName } from '../reflection/wireSchema.js';
import type { WireType } from '../reflection/WireType.js';
import { assertClientOutput } from '../introspection/ClientManifest.js';
import { isQueryPage, queryPage } from './QueryPage.js';
import type { QueryOptions } from './QueryOptions.js';
import type { QueryResult } from './QueryResult.js';
import { renderQueryData } from './queryRendering.js';

/** Run provider rendering and exact-type interception inside the current query scope, for every emission. */
export async function renderQuery(definition: Pick<DescriptorBase, 'clientOutput'> & { wireOutput?: boolean; wireType?: WireType }, data: unknown,
    context: ExecutionContext, options: QueryOptions = {}, settings: ArcOptions = {}): Promise<QueryResult> {
    const scope = currentServices();
    for (const token of settings.queryRenderers ?? []) {
        const renderer = await scope.resolve(token);
        if (renderer.canRender(data)) { data = await renderer.render(data, context, options); break; }
    }
    if (!settings.readModelInterceptors?.length)
        return renderQueryData(definition, definition.wireOutput ? encode(data, definition.wireType, definition.wireType) : data, context, options);
    const interceptors = await Promise.all(settings.readModelInterceptors.map(token => scope.resolve(token)));
    const field = definition.wireType && options.sorting ? fieldsFor(definition.wireType)
        .find(candidate => wireName(candidate.name) === options.sorting?.field) : undefined;
    const rawOptions = field && options.sorting ? { ...options, sorting: { ...options.sorting, field: field.name } } : options;
    const page = Array.isArray(data) ? renderQueryData({ clientOutput: undefined }, data, context, rawOptions) : undefined;
    if (page && !page.isSuccess) return page;
    if (page) data = page.data;
    const intercept = async (item: unknown): Promise<unknown> => {
        if (item === null || typeof item !== 'object') return item;
        for (const handler of interceptors) {
            if (item && typeof item === 'object' && item.constructor === handler.model)
                item = await handler.intercept(item);
        }
        return item;
    };
    if (isQueryPage(data)) {
        data = queryPage(await Promise.all(data.items.map(intercept)), data.totalItems, data.sorting);
    } else if (Array.isArray(data)) data = await Promise.all(data.map(intercept));
    else data = await intercept(data);
    if (page) {
        const output = definition.wireOutput ? encode(data, definition.wireType, definition.wireType) : data;
        return { ...page, data: definition.clientOutput ? assertClientOutput(definition.clientOutput.output, output) : output };
    }
    return renderQueryData(definition, definition.wireOutput ? encode(data, definition.wireType, definition.wireType) : data, context, options);
}
