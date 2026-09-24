// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

describe('when a second package module reads decorated metadata', given(an_application_builder, context => {
    let recognized: boolean;
    beforeEach(async () => {
        class SharedCommand { handle(): void {} }
        command()(SharedCommand);
        context.builder.add(SharedCommand);
        const alternate = await import('../../reflection/metadata.js?duplicate' as string) as
            typeof import('../../reflection/metadata.js');
        recognized = alternate.ownMetadata(SharedCommand).command === true;
    });
    it('should share its symbol-keyed metadata registry', () => { recognized.should.equal(true); });
}));
