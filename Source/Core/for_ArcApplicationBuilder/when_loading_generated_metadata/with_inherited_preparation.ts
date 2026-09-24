// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { randomUUID } from 'node:crypto';
import { field } from '@cratis/fundamentals';
import { ArcApplication, canonicalMetadataSignature, command, rejected, validation, Severity, type Outcome } from '../../index.js';
import type { CommandResult } from '../../commands/CommandResult.js';

class Prepared { constructor(readonly name: string) {} }
class BaseTask {
    @field(String) title!: string;
    provide(): Prepared | Outcome<never> {
        return this.title ? new Prepared('prepared') : rejected(validation('Title required', ['title']));
    }
    handle(prepared: Prepared, tasks: Prepared): string { return `${prepared.name}:${tasks.name}`; }
}
@command()
class InheritedTask extends BaseTask { @field(Number) count!: number; }

describe('when executing an inherited command with generated bindings', () => {
    let result: CommandResult;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.useGeneratedMetadata({ version: 1, artifacts: [{ type: InheritedTask,
            signature: canonicalMetadataSignature('InheritedTask', [['title', 'String'], ['count', 'Number']], 2, 0, []),
            metadata: { command: true, handleParameters: 1, generatedBindings: true,
                injected: new Map([['handle', [Prepared]], ['provide', []]]),
                handleResult: { cardinality: 'one', nullable: false, element: String } } }] });
        builder.services.addSingleton(Prepared, () => new Prepared('service'));
        builder.add(InheritedTask);
        const app = await builder.build();
        try {
            result = await app.server.execute(Object.assign(new InheritedTask(), { title: 'yes', count: 1 }), {
                correlationId: randomUUID(), signal: new AbortController().signal, allowedSeverity: Severity.Warning,
                principal: undefined, tenantId: undefined
            });
        } finally { await app.dispose(); }
    });
    it('should pass the prepared value before the service', () => {
        (result.response as string).should.equal('prepared:service');
    });
});
