// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();

describe('when handling an observable snapshot with a failing producer', () => {
    let status: number | undefined;
    let body: { exceptionMessages: string[]; exceptionStackTrace: string };

    beforeEach(async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: (): CurrentValueSubject<number> => {
                throw new Error('private database password');
            }
        })] });
        const response = await server.handle(new Request('http://localhost/api/value'));
        status = response?.status;
        body = await response!.json();
        await server.dispose();
    });

    it('should report failure', () => { status?.should.equal(500); });
    it('should redact the exception message', () => { body.exceptionMessages.should.deep.equal(['An unexpected error occurred']); });
    it('should redact the stack trace', () => { body.exceptionStackTrace.should.equal(''); });
    it('should not disclose the private failure', () => { JSON.stringify(body).includes('private database password').should.equal(false); });
});
