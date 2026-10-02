// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../../../execution/ExecutionContext.js';
import { a_command_with_validation_state } from '../given/a_command_with_validation_state.js';

describe('when building with an injected validator service', () => {
    let context: a_command_with_validation_state;
    let identity: ExecutionContext | undefined;
    beforeEach(async () => {
        context = new a_command_with_validation_state(scope => {
            identity = scope.identity;
            return context.probe;
        });
        const application = await context.builder.build();
        await application.dispose();
    });
    it('should construct the validator with its ordinary service', () => { context.probe.constructed.should.equal(1); });
    it('should not read command state or evaluate rules', () => {
        context.resolver.lookup.called.should.equal(false);
        context.probe.validated.should.have.lengthOf(0);
    });
    it('should construct services without a tenant or command identity', () => {
        (identity!.tenantId === undefined).should.equal(true);
        identity!.correlationId.should.equal('');
        ('command' in identity!).should.equal(false);
    });
});
