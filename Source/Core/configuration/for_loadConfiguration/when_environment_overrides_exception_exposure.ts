// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { loadConfiguration } from '../loadConfiguration.js';

should();
describe('when the exception exposure environment setting overrides the file', () => {
    let configuration: ReturnType<typeof loadConfiguration>;
    beforeEach(() => {
        configuration = loadConfiguration(new URL('./given/appsettings.json', import.meta.url), {
            Cratis__Arc__ExposeExceptionDetails: 'False'
        });
    });
    it('should prefer the environment setting', () => { configuration.Cratis?.Arc?.exposeExceptionDetails?.should.equal(false); });
});
