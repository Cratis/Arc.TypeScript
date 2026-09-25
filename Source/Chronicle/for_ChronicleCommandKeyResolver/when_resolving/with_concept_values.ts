// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, Guid } from '@cratis/fundamentals';
import { ChronicleCommandKeyResolver } from '../../ChronicleCommandKeyResolver.js';

class NumericId extends ConceptAs<number> {}
class GuidId extends ConceptAs<Guid> {}

describe('when resolving a Chronicle event source id from a command', () => {
    const resolver = new ChronicleCommandKeyResolver();
    it('should convert a numeric concept to its primitive string', () => {
        resolver.resolve({ getEventSourceId: () => new NumericId(42) })!.should.equal('42');
    });
    it('should convert a Guid concept to its Guid string', () => {
        const guid = Guid.create();
        resolver.resolve({ getEventSourceId: () => new GuidId(guid) })!.should.equal(guid.toString());
    });
    it('should leave an empty string to the normal command key fallback', () => {
        (resolver.resolve({ getEventSourceId: () => '' }) === undefined).should.equal(true);
    });
    it('should reject unsupported objects instead of an ambiguous id', () => {
        (() => resolver.resolve({ getEventSourceId: () => ({ value: 'x' }) })).should.throw('invalid event source id');
    });
});
