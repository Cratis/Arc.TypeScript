// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { loadConfiguration } from '../loadConfiguration.js';

should();
describe('when a configuration file contains invalid JSON', () => {
    let failure: Error | undefined;
    beforeEach(() => {
        try { loadConfiguration(new URL('./given/invalid.json', import.meta.url), {}); }
        catch (error) { failure = error as Error; }
    });
    it('should name the file without revealing its contents', () => {
        failure!.message.should.contain('invalid.json');
        failure!.message.should.not.contain('secret-chonicle-password');
    });
});
