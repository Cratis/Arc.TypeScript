// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolveEventSourceSelector } from '../../eventSourceDefinition.js';
import type { EventSourceSelector } from '../../EventSourceSelector.js';

describe('when resolving a selector', () => {
    class Account {}
    it('should return a class unchanged', () => resolveEventSourceSelector(Account).should.equal(Account));
    it('should return a name unchanged', () => resolveEventSourceSelector('Account').should.equal('Account'));
    it('should call an arrow thunk', () => resolveEventSourceSelector((() => Account) as EventSourceSelector).should.equal(Account));
    it('should reject a thunk that returns neither a class nor a name', () => {
        (() => resolveEventSourceSelector((() => undefined) as unknown as EventSourceSelector)).should.throw('arrow function returning one');
    });
});
