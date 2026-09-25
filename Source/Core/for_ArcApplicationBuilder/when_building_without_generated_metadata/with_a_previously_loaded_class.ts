// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../index.js';
import { RegisterTask } from '../../../../Samples/Tasks/Features/Tasks/Registration/Registration.js';
import { Tasks } from '../../../../Samples/Tasks/Features/Tasks/Tasks.js';
import { metadata } from '../../../../Samples/Tasks/Features/generatedMetadata.js';

describe('when building without metadata after another builder used the same class', () => {
    let error: unknown;
    beforeEach(async () => {
        const first = ArcApplication.createBuilder();
        first.useGeneratedMetadata(metadata);
        first.services.addSingleton(Tasks);
        first.add(RegisterTask);
        const application = await first.build();
        await application.dispose();
        const second = ArcApplication.createBuilder();
        second.services.addSingleton(Tasks);
        second.add(RegisterTask);
        try { await second.build(); }
        catch (failure) { error = failure; }
    });
    it('should not inherit bindings from another builder', () => {
        (error as Error).message.should.contain('Unbound handle parameters');
    });
});
