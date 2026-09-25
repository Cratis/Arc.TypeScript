// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { CratisApplication } from '../index.js';

should();
describe('when creating the Cratis application builder', () => {
    let application: Awaited<ReturnType<ReturnType<typeof CratisApplication.createBuilder>['build']>>;
    beforeEach(async () => {
        application = await CratisApplication.createBuilder({ configuration: false }, {
            eventStore: 'Tasks', connectionString: 'chronicle://localhost:35000'
        }).build();
    });
    afterEach(async () => { await application.dispose(); });
    it('should not install authentication implicitly', () => {
        (application.server.options.authentication ?? []).length.should.equal(0);
        (application.server.options.nativePrincipal ?? false).should.equal(false);
    });
});
