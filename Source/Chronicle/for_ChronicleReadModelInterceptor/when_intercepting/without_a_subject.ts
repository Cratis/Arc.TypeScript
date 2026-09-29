// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../../given/a_projection.js';

describe('when intercepting a protected model without a subject that holds no protected values', given(a_projection, context => {
    let masked: object;
    let result: object;
    beforeEach(async () => {
        context.release.resetHistory();
        const interceptor = context.interceptor('private');
        masked = Object.assign(new context.model(), { id: '', name: '' });
        result = await interceptor.intercept(masked);
    });
    it('should serve it', () => result.should.equal(masked));
    it('should not ask Chronicle to release it', () => context.release.called.should.equal(false));
    it('should trust it', () => context.interceptor('private').isReleased(result).should.equal(true));
}));

describe('when intercepting a protected model without a subject that holds a protected value', given(a_projection, context => {
    let error: Error | undefined;
    beforeEach(async () => {
        context.release.resetHistory();
        const masked = Object.assign(new context.model(), { id: '', name: 'ciphertext' });
        try { await context.interceptor('private').intercept(masked); }
        catch (reason) { error = reason as Error; }
    });
    it('should fail naming the missing subject', () => error!.message.should.contain('without a subject'));
    it('should not ask Chronicle to release it', () => context.release.called.should.equal(false));
}));
