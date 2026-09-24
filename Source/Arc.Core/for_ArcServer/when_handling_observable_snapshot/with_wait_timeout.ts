// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();

describe('when handling an observable snapshot with a wait timeout', () => {
    let status: number | undefined;
    let message: string;

    beforeEach(async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Pending', schema: z.object({}), observe: () => new CurrentValueSubject<number>()
        })] });
        const response = await server.handle(new Request('http://localhost/api/pending?waitForFirstResult=TrUe&waitForFirstResultTimeout=0.01'));
        status = response?.status;
        message = (await response!.json()).exceptionMessages[0];
        await server.dispose();
    });

    it('should respond with a timeout', () => { status?.should.equal(408); });
    it('should preserve the timeout message', () => { message.should.match(/Timed out waiting/); });
});
