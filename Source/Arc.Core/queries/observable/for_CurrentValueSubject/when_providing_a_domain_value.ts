// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { CurrentValueSubject } from '../CurrentValueSubject.js';

should();

describe('when providing a domain value shaped like a presence marker', () => {
    let value: { hasValue: boolean; name: string };
    let current: ReturnType<CurrentValueSubject<typeof value>['current']>;

    beforeEach(() => {
        value = { hasValue: false, name: 'ordinary data' };
        current = CurrentValueSubject.of(value).current();
    });

    it('should report that it has a value', () => { current.hasValue.should.equal(true); });
    it('should retain the domain value', () => {
        if (!current.hasValue) throw new Error('Expected a current value');
        current.value.should.deep.equal(value);
    });
});
