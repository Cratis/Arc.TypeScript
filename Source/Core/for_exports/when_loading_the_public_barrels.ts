// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import * as node from '../index.js';
import * as fetch from '../fetch.js';
import * as hosting from '../hosting.js';

describe('when loading the public Arc barrels', () => {
    const internal = ['commandResult', 'malformed', 'status', 'emptyPaging', 'recordFailure'];
    it('should keep result helpers off the Node root', () => {
        internal.filter(name => Object.hasOwn(node, name)).should.deep.equal([]);
    });
    it('should keep result helpers off the Fetch root', () => {
        internal.filter(name => Object.hasOwn(fetch, name)).should.deep.equal([]);
    });
    it('should expose failure tracking to hosting integrations', () => {
        hosting.recordFailure.should.be.a('function');
    });
    it('should retain branded command outcomes on the root', () => {
        node.tuple.should.be.a('function');
        node.rejected.should.be.a('function');
    });
});
