// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { given } from '../../../given.js';
import { Severity } from '../../../validation/Severity.js';
import { a_rendering_server } from '../given/a_rendering_server.js';
import { Task } from '../given/Task.js';
should();

describe('when rendering an observable with multiple emissions', given(a_rendering_server, context => {
    let values: unknown[];
    beforeEach(async () => {
        const session = await context.server.openObservableQuery('Watch', {}, {
            correlationId: crypto.randomUUID(), signal: new AbortController().signal, allowedSeverity: Severity.Error,
            principal: undefined, tenantId: undefined
        });
        try {
            const stream = session.results();
            const initial = await stream.next();
            context.source.next([new Task('later')]);
            const later = await stream.next();
            values = [initial.value?.data, later.value?.data];
        } finally { await session.close(); }
    });
    afterAll(() => context.server.dispose());
    it('should intercept each delivery without mutating the shared source', () => {
        values.should.deep.equal([[{ name: 'public-initial' }], [{ name: 'public-later' }]]);
        context.source.current().should.deep.equal({ hasValue: true, value: [new Task('later')] });
    });
}));
