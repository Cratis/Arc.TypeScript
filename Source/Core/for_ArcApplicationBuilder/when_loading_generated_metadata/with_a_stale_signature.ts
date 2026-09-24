// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../index.js';
import { metadata } from '../../../../Samples/Tasks/Features/generatedMetadata.js';

/** The generated version and shape are checked before modifying registrations. */
describe('when loading generated metadata with a stale signature', () => {
    let error: unknown;
    beforeEach(() => {
        const builder = ArcApplication.createBuilder();
        const stale = { ...metadata, artifacts: metadata.artifacts.map((entry, index) =>
            index === 0 ? { ...entry, signature: 'outdated' } : entry) };
        try { builder.useGeneratedMetadata(stale); }
        catch (failure) { error = failure; }
    });
    it('should require regeneration before accepting the module', () => {
        (error as Error).message.should.contain('regenerate artifact metadata');
    });
});
