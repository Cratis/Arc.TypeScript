// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_builder_with_registered_artifacts } from '../given/a_builder_with_registered_artifacts.js';
import { Echo } from '../given/Echo.js';
import { Item } from '../given/Item.js';
import type { ClassType } from '../../reflection/ClassType.js';

describe('when adding an artifact observer after registration with registered types',
    given(a_builder_with_registered_artifacts, context => {
        const seen: ClassType[] = [];
        beforeEach(() => {
            context.builder.addArtifactObserver(type => { seen.push(type); return false; });
        });
        it('should replay the registered types once in registration order', () => {
            seen.should.deep.equal([Echo, Item]);
        });
    }));
