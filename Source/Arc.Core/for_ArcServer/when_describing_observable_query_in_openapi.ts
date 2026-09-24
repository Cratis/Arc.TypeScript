// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../ArcServer.js';
import { CurrentValueSubject } from '../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../queries/observable/defineObservableQuery.js';

should();

describe('when describing an observable query in OpenAPI', () => {
    let replies: Record<string, { content: Record<string, { schema: { type: string } }>; description: string }>;

    beforeEach(async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => new CurrentValueSubject(1)
        })] });
        const response = await server.handle(new Request('http://localhost/openapi.json'));
        replies = (await response!.json()).paths['/api/value'].get.responses;
        await server.dispose();
    });

    it('should document SSE', () => { replies['200']?.content['text/event-stream']?.schema.type.should.equal('string'); });
    it('should document pending snapshots', () => { replies['202']?.description.should.equal('No current value'); });
    it('should document wait timeout', () => { replies['408']?.description.should.equal('First-result wait timed out'); });
    it('should document overload', () => { replies['503']?.description.should.equal('Subscription limit reached'); });
});
