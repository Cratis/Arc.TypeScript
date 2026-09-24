// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { CurrentValueSubject } from '../CurrentValueSubject.js';

should();

describe('when publishing to a pending subject', () => {
    let subject: CurrentValueSubject<number>;

    beforeEach(() => {
        subject = CurrentValueSubject.pending<number>();
        subject.next(4);
    });

    it('should expose a current value', () => { subject.current().hasValue.should.be.true; });
});
