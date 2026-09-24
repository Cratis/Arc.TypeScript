// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();

describe('when handling an observable snapshot with a pending value', () => {
    let status: number | undefined;
    let result: { isReady: boolean; hasExceptions: boolean };

    beforeEach(async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => new CurrentValueSubject<number[]>()
        })] });
        const response = await server.handle(new Request('http://localhost/api/numbers'));
        status = response?.status;
        result = await response!.json();
        await server.dispose();
    });

    it('should report pending', () => { status?.should.equal(202); });
    it('should report the value is not ready', () => { result.isReady.should.be.false; });
    it('should not report an exception', () => { result.hasExceptions.should.be.false; });
});
