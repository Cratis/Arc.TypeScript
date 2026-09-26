// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, command, inject, optionalService } from '../../index.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
should();

let calls: string[];
class OptionalDependency { [Symbol.dispose](): void { calls.push('disposed'); } }
@command()
class OptionalCommand {
    @inject(optionalService(OptionalDependency))
    provide(service: OptionalDependency | null): string { void service; calls.push('provide'); return 'prepared'; }
    handle(prepared: string): void { void prepared; calls.push('handle'); }
}
function deferred<T>() {
    let release!: (value: T) => void;
    const promise = new Promise<T>(resolve => { release = resolve; });
    return { promise, release };
}
describe('when an optional command service factory settles after cancellation', () => {
    let application: FetchArcApplication;
    let result: CommandResult;
    beforeEach(async () => {
        calls = [];
        const started = deferred<void>();
        const pending = deferred<OptionalDependency>();
        const controller = new AbortController();
        const builder = ArcApplication.createBuilder();
        builder.services.addScoped(OptionalDependency, () => { started.release(); return pending.promise; });
        builder.add(OptionalCommand);
        application = await builder.build();
        const running = application.server.executeCommand('OptionalCommand', {}, {
            correlationId: 'optional-cancel', principal: undefined, tenantId: undefined, allowedSeverity: 2,
            signal: controller.signal
        });
        await started.promise;
        controller.abort(new Error('canceled'));
        pending.release(new OptionalDependency());
        result = await running;
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail with cancellation', () => {
        result.isSuccess.should.equal(false);
        result.exceptionMessages.join(' ').should.contain('canceled');
    });
    it('should not invoke provide or handle', () => { calls.should.not.contain('provide'); calls.should.not.contain('handle'); });
    it('should dispose the resolved service', () => { calls.should.contain('disposed'); });
});
