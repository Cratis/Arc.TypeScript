// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();

describe('when handling an observable snapshot with a current value', () => {
    let status: number | undefined;
    let data: number[];

    beforeEach(async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => CurrentValueSubject.of<number[]>([1, 2])
        })] });
        const response = await server.handle(new Request('http://localhost/api/numbers'));
        status = response?.status;
        data = (await response!.json()).data;
        await server.dispose();
    });

    it('should return a successful snapshot', () => { status?.should.equal(200); });
    it('should return the current value', () => { data.should.deep.equal([1, 2]); });
});
