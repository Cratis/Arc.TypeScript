// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { NestedReduced, ProjectedView, sdk_reads, Unprotected } from '../given/sdk_reads.js';

describe('when iterating a removed change of a protected reducer model', given(sdk_reads, context => {
    let model: object;
    beforeEach(async () => {
        context.removed = true;
        model = await context.watched(NestedReduced);
    });
    it('should not serve the removed payload, which the SDK never released', () =>
        Object.keys(model).length.should.equal(0));
    it('should serve an empty instance of the model', () => (model instanceof NestedReduced).should.equal(true));
    it('should trust the empty instance', () => context.isReleased(NestedReduced, model).should.equal(true));
}));

describe('when iterating a removed change of a protected projection', given(sdk_reads, context => {
    let model: object;
    beforeEach(async () => {
        context.removed = true;
        model = await context.watched(ProjectedView);
    });
    it('should keep the payload the kernel released', () => (model as ProjectedView).name.should.equal('last'));
    it('should trust it', () => context.isReleased(ProjectedView, model).should.equal(true));
}));

describe('when iterating a removed change of an unprotected model', given(sdk_reads, context => {
    let model: object;
    beforeEach(async () => {
        context.removed = true;
        model = await context.watched(Unprotected);
    });
    it('should keep the payload', () => (model as Unprotected).name.should.equal('last'));
}));
