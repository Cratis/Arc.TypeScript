// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../ArcApplication.js';

describe('when starting with an invalid configured Node hosting URL', () => {
    let message: string;
    beforeEach(async () => {
        const app = await ArcApplication.createBuilder({ configuration: false,
            hosting: { applicationUrl: 'https://127.0.0.1:3000/' } }).build();
        try { await app.start(); }
        catch (error) { message = (error as Error).message; }
        finally { await app.dispose(); }
    });
    it('should refuse to start an HTTPS listener without TLS settings', () => {
        message.should.equal('Invalid Arc application URL');
    });
});
