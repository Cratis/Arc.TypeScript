// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer } from '../../ArcServer.js';

for (const enabled of ['false', 0, null]) describe(`when configuring discovery with an invalid enabled value ${enabled}`, () => {
    let failure: unknown;
    beforeEach(() => {
        try { new ArcServer({ introspection: { enabled: enabled as unknown as boolean } }); } catch (error) { failure = error; }
    });
    it('should reject non-boolean code options', () => String(failure).should.contain('Cratis:Arc:Introspection:Enabled must be a boolean'));
});
