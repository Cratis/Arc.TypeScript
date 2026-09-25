// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';
import { Echo } from '../given/Echo.js';
import { Item } from '../given/Item.js';
import type { ClassType } from '../../reflection/ClassType.js';

class a_builder_with_an_early_observer extends an_application_builder {
    readonly seen: ClassType[] = [];
    constructor() {
        super();
        this.builder.addArtifactObserver(type => { this.seen.push(type); return false; });
    }
}

describe('when registering artifacts after adding an observer with later types', given(a_builder_with_an_early_observer, context => {
    beforeEach(() => { context.builder.add(Echo, Item); });
    it('should deliver each later registration in order', () => { context.seen.should.deep.equal([Echo, Item]); });
}));
