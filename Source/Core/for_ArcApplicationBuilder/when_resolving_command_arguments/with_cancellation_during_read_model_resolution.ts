// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, command, commandReadModel, inject, key } from '../../index.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
should();

class Details {}
const model = commandReadModel(Details);
@command()
class UpdateDetails {
    @field(String) @key() id!: string;
    @inject(model)
    provide(details: Details): string { void details; calls.push('provide'); return 'prepared'; }
    handle(prepared: string): void { void prepared; calls.push('handle'); }
}
let calls: string[];

function deferred<T>() {
    let release!: (value: T) => void;
    const promise = new Promise<T>(resolve => { release = resolve; });
    return { promise, release };
}

describe('when a command read-model resolution settles after cancellation', () => {
    let application: FetchArcApplication;
    let result: CommandResult;
    beforeEach(async () => {
        calls = [];
        const started = deferred<void>();
        const pending = deferred<Details>();
        const controller = new AbortController();
        class Resolver {
            supports(): boolean { return true; }
            find<T>(): Promise<T | null> { started.release(); return pending.promise as unknown as Promise<T | null>; }
            [Symbol.dispose](): void { calls.push('disposed'); }
        }
        const builder = ArcApplication.createBuilder();
        builder.services.addScoped(Resolver);
        builder.addReadModelForCommandResolver(Resolver).add(UpdateDetails);
        application = await builder.build();
        const running = application.server.executeCommand('UpdateDetails', { id: 'one' }, {
            correlationId: 'read-model-cancel', principal: undefined, tenantId: undefined, allowedSeverity: 2,
            signal: controller.signal
        });
        await started.promise;
        controller.abort(new Error('canceled'));
        pending.release(new Details());
        result = await running;
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail with cancellation', () => {
        result.isSuccess.should.equal(false);
        result.exceptionMessages.join(' ').should.contain('canceled');
    });
    it('should not invoke provide or handle', () => { calls.should.not.contain('provide'); calls.should.not.contain('handle'); });
    it('should dispose the scoped resolver', () => { calls.should.contain('disposed'); });
});
