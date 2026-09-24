// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServerOptions } from '../ArcServerOptions.js';
import type { DescriptorBase } from '../DescriptorBase.js';
import type { ExecutionContext } from '../execution/ExecutionContext.js';
import { currentServices } from '../dependencyInjection/ServiceScope.js';
import { encode } from '../reflection/wireSchema.js';
import { isQueryPage, queryPage } from './QueryPage.js';
import type { QueryOptions } from './QueryOptions.js';
import type { QueryResult } from './QueryResult.js';
import { renderQueryData } from './queryRendering.js';

/** Run provider rendering and exact-type interception inside the current query scope, for every emission. */
export async function renderQuery(definition: Pick<DescriptorBase, 'clientOutput'> & { wireOutput?: boolean }, data: unknown,
    context: ExecutionContext, options: QueryOptions = {}, settings: ArcServerOptions = {}): Promise<QueryResult> {
    const scope = currentServices();
    for (const token of settings.queryRenderers ?? []) {
        const renderer = await scope.resolve(token);
        if (renderer.canRender(data)) { data = await renderer.render(data, context, options); break; }
    }
    if (!settings.readModelInterceptors?.length)
        return renderQueryData(definition, definition.wireOutput ? encode(data) : data, context, options);
    const intercept = async (item: unknown): Promise<unknown> => {
        if (item === null || typeof item !== 'object') return item;
        for (const token of settings.readModelInterceptors ?? []) {
            const handler = await scope.resolve(token);
            if (item && typeof item === 'object' && item.constructor === handler.model)
                item = await handler.intercept(item);
        }
        return item;
    };
    if (isQueryPage(data)) {
        data = queryPage(await Promise.all(data.items.map(intercept)), data.totalItems, data.sorting);
    } else if (Array.isArray(data)) data = await Promise.all(data.map(intercept));
    else data = await intercept(data);
    return renderQueryData(definition, definition.wireOutput ? encode(data) : data, context, options);
}
