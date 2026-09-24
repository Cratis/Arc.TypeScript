// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();

describe('when subscribing to SSE with direct frames', () => {
    let contentType: string | null | undefined;
    let text: string;

    beforeEach(async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => CurrentValueSubject.of<number[]>([5])
        })] });
        const response = await server.handle(new Request('http://localhost/api/numbers', {
            headers: { accept: 'text/event-stream' }
        }));
        contentType = response?.headers.get('content-type');
        const reader = response!.body!.getReader();
        text = new TextDecoder().decode((await reader.read()).value);
        await reader.cancel();
        await server.dispose();
    });

    it('should return the SSE content type', () => { contentType?.should.equal('text/event-stream; charset=utf-8'); });
    it('should start with a direct JSON frame', () => { text.startsWith('data: {').should.equal(true); });
    it('should terminate the frame with a blank line', () => { text.endsWith('}\n\n').should.equal(true); });
    it('should include the current value without a hub envelope', () => { JSON.parse(text.slice(6)).data.should.deep.equal([5]); });
});
