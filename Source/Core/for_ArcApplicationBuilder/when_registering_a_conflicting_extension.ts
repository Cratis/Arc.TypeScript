// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcApplicationBuilder } from '../ArcApplicationBuilder.js';

should();
describe('when registering two implementations for one integration name', () => {
    let failure: Error | undefined;
    beforeEach(() => {
        const install = () => {};
        ArcApplicationBuilder.registerExtension('conflicting-spec-extension', install);
        ArcApplicationBuilder.registerExtension('conflicting-spec-extension', install);
        try { ArcApplicationBuilder.registerExtension('conflicting-spec-extension', () => {}); }
        catch (error) { failure = error as Error; }
    });
    it('should report the conflicting integration name', () => {
        failure!.message.should.contain('Conflicting Arc integration registration: conflicting-spec-extension');
    });
});
