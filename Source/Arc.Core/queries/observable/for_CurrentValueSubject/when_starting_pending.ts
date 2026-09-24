// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { CurrentValueSubject } from '../CurrentValueSubject.js';

should();

describe('when starting pending', () => {
    let subject: CurrentValueSubject<number>;

    beforeEach(() => { subject = CurrentValueSubject.pending<number>(); });

    it('should not invent a current value', () => { subject.current().hasValue.should.equal(false); });
});
