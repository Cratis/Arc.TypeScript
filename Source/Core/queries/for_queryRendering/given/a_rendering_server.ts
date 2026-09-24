// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { serviceToken } from '../../../dependencyInjection/ServiceToken.js';
import { CurrentValueSubject } from '../../observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../observable/defineObservableQuery.js';
import { defineQuery } from '../../defineQuery.js';
import { queryPage } from '../../QueryPage.js';
import type { QueryRenderer } from '../../QueryRenderer.js';
import type { ReadModelInterceptor } from '../../ReadModelInterceptor.js';
import { Task } from './Task.js';

export class a_rendering_server {
    readonly source = CurrentValueSubject.of([new Task('initial')]);
    readonly renderer = serviceToken<QueryRenderer>('renderer');
    readonly interceptor = serviceToken<ReadModelInterceptor>('interceptor');
    readonly seen: string[] = [];
    readonly server = new ArcServer({
        services: [
            { token: this.renderer, lifetime: 'scoped', factory: () => ({
                canRender: (value: unknown) => value === 'provider',
                render: () => { this.seen.push('render'); return queryPage([new Task('provider')], 3); }
            }) },
            { token: this.interceptor, lifetime: 'scoped', factory: () => ({
                model: Task, intercept: (model: object) => {
                    const task = model as Task;
                    this.seen.push(task.name);
                    return new Task(`public-${task.name}`);
                }
            }) }
        ],
        queryRenderers: [this.renderer], readModelInterceptors: [this.interceptor],
        queries: [defineQuery({ name: 'Tasks', schema: z.object({}), perform: () => 'provider' })],
        observableQueries: [defineObservableQuery({ name: 'Watch', schema: z.object({}), observe: () => this.source })]
    });
}
