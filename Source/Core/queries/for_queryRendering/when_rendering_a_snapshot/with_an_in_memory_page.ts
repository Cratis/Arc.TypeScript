// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { should } from 'vitest';
import { given } from '../../../given.js';
import { ArcServer } from '../../../ArcServer.js';
import { serviceToken } from '../../../dependencyInjection/ServiceToken.js';
import { defineQuery } from '../../defineQuery.js';
import type { ReadModelInterceptor } from '../../ReadModelInterceptor.js';
import { Task } from '../given/Task.js';
should();

class an_in_memory_page {
    readonly seen: string[] = [];
    readonly token = serviceToken<ReadModelInterceptor>('page interceptor');
    readonly server = new ArcServer({
        services: [{ token: this.token, lifetime: 'scoped', factory: () => ({
            model: Task, intercept: (item: object) => {
                this.seen.push((item as Task).name);
                return item;
            }
        }) }],
        readModelInterceptors: [this.token],
        queries: [defineQuery({ name: 'Tasks', schema: z.object({}), perform: () => [
            new Task('first'), new Task('second'), new Task('third')
        ] })]
    });
}
describe('when rendering a snapshot with an in-memory page', given(an_in_memory_page, context => {
    let result: Record<string, unknown>;
    beforeEach(async () => {
        const response = (await context.server.handle(new Request('http://localhost/api/tasks?page=1&pageSize=1')))!;
        result = await response.json() as Record<string, unknown>;
    });
    afterAll(() => context.server.dispose());
    it('should intercept only the selected page', () => {
        context.seen.should.deep.equal(['second']);
    });
    it('should retain the full array total', () => {
        (result.paging as { totalItems: number }).totalItems.should.equal(3);
    });
}));
