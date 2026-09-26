// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { ArcApplication } from '../../ArcApplication.js';
import { command } from '../../commands/modelBound/command.js';
import type { CommandResponseValueHandler } from '../../commands/CommandResponseValueHandler.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
should();

let cancellation: AbortController;
@command()
class ReturnValueAfterCancellation {
    handle(): string {
        cancellation.abort(new Error('canceled'));
        return 'unclassified';
    }
}

describe('when a model-bound command returns after cancellation without acknowledging a commit', () => {
    it('should not return an unclassified value as a successful client response', async () => {
        cancellation = new AbortController();
        let resolutions = 0;
        const token = serviceToken<CommandResponseValueHandler>('response handler');
        const builder = ArcApplication.createBuilder({ configuration: false,
            services: [{ token, lifetime: ServiceLifetime.Scoped,
                factory: () => { resolutions++; return { canHandle: () => true, handle: () => {} }; } }],
            commandResponseValueHandlers: [token] });
        builder.add(ReturnValueAfterCancellation);
        const application = await builder.build();
        try {
            const result = await application.server.executeCommand('ReturnValueAfterCancellation', {}, {
                correlationId: 'model-canceled', allowedSeverity: 2, principal: undefined, tenantId: undefined,
                signal: cancellation.signal });
            result.isSuccess.should.equal(false);
            result.exceptionMessages.should.deep.equal(['Error: canceled']);
            (result.response === undefined).should.equal(true);
            resolutions.should.equal(0);
        } finally { await application.dispose(); }
    });
});
