// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';
import type { ClassType } from '../../reflection/ClassType.js';

describe('when adding an artifact observer after registration without registered types', given(an_application_builder, context => {
    const seen: ClassType[] = [];
    beforeEach(() => { context.builder.addArtifactObserver(type => { seen.push(type); return false; }); });
    it('should not replay any types to an observer added earlier', () => { seen.should.deep.equal([]); });
}));
