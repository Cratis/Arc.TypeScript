// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { given } from '../../../given.js';
import { an_application_builder } from '../../../for_ArcApplicationBuilder/given/an_application_builder.js';
import { Register } from '../given/Register.js';
import { ThrowingNameValidator } from '../given/ThrowingNameValidator.js';

describe('when a validator throws with an earlier failure', given(an_application_builder, context => {
    let result: { validationResults: { reason: string; members: string[]; message: string }[] };
    let logger: sinon.SinonSpy;
    beforeEach(async () => {
        logger = sinon.spy();
        const builder = context.create({ development: true, logger });
        builder.add(Register, ThrowingNameValidator);
        const application = await builder.build();
        const response = await application.server.handle(new Request('http://localhost/api/register/validate', {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ entries: [{ name: '' }] })
        }));
        result = await response!.json();
        await application.dispose();
    });
    it('should replace all results from the throwing validator', () => {
        result.validationResults.should.deep.equal([{ severity: 3, message: 'The value could not be validated.', members: [], reason: 'validatorFailed' }]);
    });
    it('should log the original validator error', () => {
        (logger.firstCall.args[0] as Error).message.should.equal('secret');
    });
}));
