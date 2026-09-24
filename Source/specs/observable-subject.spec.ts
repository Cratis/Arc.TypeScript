// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { CurrentValueSubject } from '../src/index.js';

should();

describe('observable current-value subject', () => {
    it('should keep a domain value shaped like a presence marker as an actual value', () => {
        const value = { hasValue: false, name: 'ordinary data' };
        const subject = CurrentValueSubject.of(value);
        const current = subject.current();
        should().equal(current.hasValue, true);
        if (current.hasValue) current.value.should.deep.equal(value);
    });

    it('should expose an explicit pending constructor without inventing a value', () => {
        const subject = CurrentValueSubject.pending<number>();
        should().equal(subject.current().hasValue, false);
        subject.next(4);
        should().equal(subject.current().hasValue, true);
    });
});
