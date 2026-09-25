// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { given } from '../given.js';
import { ArcApplication } from '../ArcApplication.js';
import { ArcServer } from '../ArcServer.js';

should();
class an_application {
    readonly app = new ArcApplication(new ArcServer({}));
}

describe('when handling a path Arc does not own', given(an_application, context => {
    let response: Response | null;
    beforeEach(async () => { response = await context.app.handle(new Request('http://example.test/foreign')); });
    afterEach(async () => { await context.app.dispose(); });
    it('should fall through to the host', () => { should().equal(response, null); });
}));
