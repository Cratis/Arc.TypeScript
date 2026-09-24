// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, command, inject, abortSignal } from '../../index.js';
should();
@command()
class PrepareWithSignal {
    @inject(abortSignal())
    provide(current: AbortSignal): string { return current.aborted ? 'canceled' : 'active'; }
    handle(value: string): string { return value; }
}
describe('when resolving a signal in provide', () => {
    let response: string | undefined;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(PrepareWithSignal);
        const app = await builder.build();
        try {
            response = (await app.server.executeCommand('PrepareWithSignal', {}, {
                correlationId: 'signal', principal: undefined, tenantId: undefined,
                allowedSeverity: 2, signal: new AbortController().signal
            })).response as string;
        } finally { await app.dispose(); }
    });
    it('should supply the request signal to provide', () => { response!.should.equal('active'); });
});
