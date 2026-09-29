// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { ArcApplicationBuilder } from '../../ArcApplicationBuilder.js';
import type { ClassType } from '../../reflection/ClassType.js';

class ChronicleOnlyReactor {}
class Unrelated {}

class DiscoveringBuilder extends ArcApplicationBuilder {
    discovered(...types: ClassType[]): this { for (const type of types) this.register(type, 'Orders', true); return this; }
}

class a_builder_with_unclaimed_discovered_types {
    builder = new DiscoveringBuilder();
}

describe('when adding an artifact observer that claims earlier discoveries after registration with unclaimed discovered types',
    given(a_builder_with_unclaimed_discovered_types, context => {
        let claimedByFirst: ClassType[];
        let seenByLater: ClassType[];
        beforeEach(() => {
            claimedByFirst = []; seenByLater = [];
            context.builder = new DiscoveringBuilder().discovered(ChronicleOnlyReactor, Unrelated);
            context.builder.addArtifactObserver(type => {
                const claimed = type === ChronicleOnlyReactor;
                if (claimed) claimedByFirst.push(type);
                return claimed;
            }, true);
            context.builder.addArtifactObserver(type => { seenByLater.push(type); return false; }, true);
        });
        it('should offer the discovered type to the integration added later', () => { claimedByFirst.should.deep.equal([ChronicleOnlyReactor]); });
        it('should replay the claimed type to later observers', () => { seenByLater.should.include(ChronicleOnlyReactor); });
        it('should keep offering unclaimed types to later observers that claim earlier discoveries', () => { seenByLater.should.include(Unrelated); });
    }));
