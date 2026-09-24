// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../index.js';
import { SaveMessages } from '../given/SaveMessages.js';

describe('when decoding nested fields with concept values', () => {
    let response: Response;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(SaveMessages);
        const application = await builder.build();
        try {
            response = (await application.server.handle(new Request('http://localhost/api/save-messages', {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ messages: [{ name: 'one' }, { name: '' }], alternative: null })
            })))!;
        } finally { await application.dispose(); }
    });
    it('should materialize and return each nested concept including an empty string', async () => {
        (await response.json()).response.should.deep.equal(['one', '']);
    });
});
