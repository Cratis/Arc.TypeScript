// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { ArcApplication } from '../../ArcApplication.js';
import type { ClassType } from '../../reflection/ClassType.js';

class Undecorated {}
class a_builder_with_a_rejected_artifact {
    readonly builder = ArcApplication.createBuilder();
    constructor() {
        try { this.builder.add(Undecorated); }
        catch { /* The rejected registration is setup for the replay assertion. */ }
    }
}

describe('when adding an artifact observer after registration without successful registration',
    given(a_builder_with_a_rejected_artifact, context => {
        const seen: ClassType[] = [];
        beforeEach(() => { context.builder.addArtifactObserver(type => { seen.push(type); return false; }); });
        it('should not replay a rejected artifact', () => { seen.should.deep.equal([]); });
    }));
