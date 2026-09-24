// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { capturePath } from '../../capturePath.js';

describe('when selecting a member by calling a method', () => {
    let failure: Error;
    beforeEach(() => {
        try { capturePath((model: { title: string }) => model.title.trim()); }
        catch (error) { failure = error as Error; }
    });
    it('should reject the selector before any request', () => {
        failure.message.should.equal('Validation selectors cannot call methods');
    });
});
