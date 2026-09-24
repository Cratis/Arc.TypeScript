// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();

describe('when handling an observable snapshot with a structural current subject', () => {
    let status: number | undefined;
    let data: number;

    beforeEach(async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => ({
                getValue: () => 7,
                subscribe() { return { unsubscribe() {} }; }
            })
        })] });
        const response = await server.handle(new Request('http://localhost/api/value'));
        status = response?.status;
        data = (await response!.json()).data;
        await server.dispose();
    });

    it('should return a current snapshot', () => { status?.should.equal(200); });
    it('should recognize getValue as the current value', () => { data.should.equal(7); });
});
