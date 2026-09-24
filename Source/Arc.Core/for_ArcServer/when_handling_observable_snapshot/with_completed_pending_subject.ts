// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();

describe('when handling an observable snapshot with a completed pending subject', () => {
    let status: number | undefined;
    let message: string;

    beforeEach(async () => {
        const subject = new CurrentValueSubject<number>();
        subject.complete();
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Pending', schema: z.object({}), observe: () => subject
        })] });
        const response = await server.handle(new Request('http://localhost/api/pending?waitForFirstResult=true'));
        status = response?.status;
        message = (await response!.json()).exceptionMessages[0];
        await server.dispose();
    });

    it('should report a protocol error', () => { status?.should.equal(500); });
    it('should describe completion without a value', () => { message.should.match(/completed before producing/); });
});
