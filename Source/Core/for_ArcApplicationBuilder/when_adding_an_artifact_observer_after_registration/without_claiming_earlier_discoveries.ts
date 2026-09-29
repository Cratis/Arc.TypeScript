// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { ArcApplicationBuilder } from '../../ArcApplicationBuilder.js';
import type { ClassType } from '../../reflection/ClassType.js';

class ChronicleOnlyReactor {}

class DiscoveringBuilder extends ArcApplicationBuilder {
    discovered(...types: ClassType[]): this { for (const type of types) this.register(type, 'Orders', true); return this; }
}

class a_builder_with_an_unclaimed_discovered_type {
    builder = new DiscoveringBuilder();
}

describe('when adding an artifact observer after registration without claiming earlier discoveries',
    given(a_builder_with_an_unclaimed_discovered_type, context => {
        let offered: ClassType[];
        beforeEach(() => {
            offered = [];
            context.builder = new DiscoveringBuilder().discovered(ChronicleOnlyReactor);
            context.builder.addArtifactObserver(type => { offered.push(type); return true; });
        });
        it('should not offer the unclaimed discovered type', () => { offered.should.have.lengthOf(0); });
    }));
