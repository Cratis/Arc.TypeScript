// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcApplicationBuilder } from '@cratis/arc.core';
import type { ChronicleRegistration } from '../ChronicleOptions.js';
import { withChronicle } from '../addChronicle.js';

should();
describe('when code supplies a Chronicle client over a configured connection string', () => {
    let failure: Error | undefined;
    beforeEach(() => {
        const builder = new ArcApplicationBuilder({}, { Cratis: { Chronicle: { connectionString: 'chronicle://localhost:35000', eventStore: 'Tasks' } } });
        try { withChronicle(builder, { client: {} as ChronicleRegistration['client'] }); }
        catch (error) { failure = error as Error; }
    });
    it('should choose the code client without a conflicting-connection error', () => { (failure === undefined).should.equal(true); });
});
