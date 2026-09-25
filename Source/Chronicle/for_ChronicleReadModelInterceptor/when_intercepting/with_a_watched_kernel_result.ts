// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { firstValueFrom } from 'rxjs';
import { given } from '../../given.js';
import { a_projection } from '../given/a_projection.js';

describe('when intercepting a kernel watch emission', given(a_projection, context => {
    let result: object;
    beforeEach(async () => {
        context.release.resetHistory();
        const change = await firstValueFrom(context.models().watch(context.model));
        result = await context.interceptor('private').intercept(change.readModel);
    });
    it('should keep the emitted value', () => { (result === context.privateView).should.equal(true); });
    it('should not release it again', () => { context.release.called.should.equal(false); });
}));
