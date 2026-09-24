// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, defineCommand, defineQuery } from '@cratis/arc.server';
import { mountExpress } from '@cratis/arc.server.express';
import { CreateWidget } from '../../.ai-work/client-candidate/CreateWidget.proxy.js';
import { GetWidgets } from '../../.ai-work/client-candidate/GetWidgets.proxy.js';
import { QueryHttpMethod, Paging, Sorting, SortDirection } from '@cratis/arc/queries';

test('published 22.19.1 client against actual Express host', async () => {
    const widgets = [];
    let handled = 0;
    const schema = z.object({ id: z.string(), name: z.string() });
    const server = new ArcServer({
        authentication: [request => request.headers.get('authorization') === 'Bearer secret'
            ? { status: AuthenticationStatus.Authenticated, principal: { id: 'client', isAuthenticated: true, roles: ['writer', 'reader'] } }
            : { status: AuthenticationStatus.Anonymous }],
        commands: [defineCommand({ name: 'CreateWidget', namespace: 'Sales', schema: z.object({ name: z.string(), note: z.string().optional() }), authorization: { roles: ['writer'] },
            handle: ({ name }) => { handled++; const item = { id: String(handled), name }; widgets.push(item); return item; } })],
        queries: [defineQuery({ name: 'GetWidgets', namespace: 'Sales', path: '/v1/widgets/search', schema: z.object({ term: z.string() }), authorization: { roles: ['reader'] },
            perform: ({ term }) => widgets.filter(widget => widget.name.includes(term)) })]
    });
    const app = express();
    mountExpress(app, server);
    const listener = app.listen(0, '127.0.0.1');
    await new Promise(resolve => listener.once('listening', resolve));
    const origin = `http://127.0.0.1:${listener.address().port}`;
    try {
        const command = new CreateWidget();
        command.setOrigin(origin);
        command.setHttpHeadersCallback(() => ({ Authorization: 'Bearer secret' }));
        command.name = 'Ada';
        const validation = await command.validate();
        assert.equal(validation.isSuccess, true, JSON.stringify(validation));
        assert.equal(handled, 0);
        const result = await command.execute();
        assert.equal(result.isSuccess, true, JSON.stringify(result));
        assert.equal(result.response?.constructor.name, 'Widget');
        assert.equal(result.response.name, 'Ada');
        const query = new GetWidgets();
        query.setOrigin(origin);
        query.setHttpHeadersCallback(() => ({ Authorization: 'Bearer secret' }));
        query.paging = new Paging(0, 10);
        query.sorting = new Sorting('name', SortDirection.ascending);
        const found = await query.perform({ term: 'Ada' });
        assert.equal(found.isSuccess, true, JSON.stringify(found));
        assert.equal(found.data[0]?.constructor.name, 'Widget');
        assert.equal(found.data[0]?.name, 'Ada');
        query.setHttpMethod(QueryHttpMethod.Query);
        const structured = await query.perform({ term: 'Ada' });
        assert.equal(structured.isSuccess, true, JSON.stringify(structured));
        const denied = new CreateWidget();
        denied.setOrigin(origin);
        denied.name = 'No';
        assert.equal((await denied.execute()).isAuthorized, false);
        assert.equal(handled, 1);
    } finally {
        await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
        await server.dispose();
    }
});
