// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../index.js';
import { SaveMessages } from '../given/SaveMessages.js';

describe('when decoding nested fields with a missing required value', () => {
    let response: Response;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(SaveMessages);
        const application = await builder.build();
        try {
            response = (await application.server.handle(new Request('http://localhost/api/save-messages', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [] })
            })))!;
        } finally { await application.dispose(); }
    });
    it('should reject the command with a malformed request result', async () => {
        response.status.should.equal(400);
        (await response.json()).validationResults[0].reason.should.equal('malformedRequest');
    });
});
