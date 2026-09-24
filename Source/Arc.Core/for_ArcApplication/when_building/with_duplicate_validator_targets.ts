// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../ArcApplication.js';
import { NameValidator } from '../../for_ModelGraphValidator/given/NameValidator.js';
import { AsyncNameValidator } from '../../for_ModelGraphValidator/given/AsyncNameValidator.js';

describe('when building with duplicate validator targets', () => {
    let failure: unknown;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(NameValidator, AsyncNameValidator);
        try { await builder.build(); } catch (error) { failure = error; }
    });
    it('should reject the duplicate target before serving', () => {
        (failure as Error).message.should.equal('Duplicate validator target: Name');
    });
});
