// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../ArcApplication.js';
import { EntryValidator } from '../given/EntryValidator.js';
import { NameValidator } from '../given/NameValidator.js';
import { Register } from '../given/Register.js';

describe('when ignoring direct concept rules with a nested owner', () => {
    let result: { validationResults: unknown[]; isSuccess: boolean };
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder({ development: true });
        builder.add(Register, EntryValidator, NameValidator);
        const application = await builder.build();
        const response = await application.server.handle(new Request('http://localhost/api/register', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entries: [{ name: '' }] })
        }));
        result = await response!.json();
        await application.dispose();
    });
    it('should not run the ignored concept validator', () => { result.validationResults.should.have.lengthOf(0); });
    it('should still execute the command', () => { result.isSuccess.should.equal(true); });
});
