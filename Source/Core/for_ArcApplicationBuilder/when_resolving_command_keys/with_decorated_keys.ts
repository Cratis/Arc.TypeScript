// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, field } from '@cratis/fundamentals';
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, command, commandContext, inject, key } from '../../index.js';
import type { CommandContext } from '../../commands/CommandContext.js';
should();
class Identity extends ConceptAs<string> { static readonly valueType = String; }
@command()
class FromConcept {
    @field(Identity) @key() id!: Identity;
    @inject(commandContext())
    handle(context: CommandContext): string { return context.key ?? ''; }
}
@command()
class FromMethod {
    @field(String) @key() id!: string;
    getKey(): string { return 'method'; }
    @inject(commandContext())
    handle(context: CommandContext): string { return context.key ?? ''; }
}
class Base {
    @field(String) @key() id!: string;
}
@command()
class Inherited extends Base {
    @inject(commandContext())
    handle(context: CommandContext): string { return context.key ?? ''; }
}
@command()
class MissingField {
    @key() id!: string;
    handle(): void {}
}
describe('when resolving decorated command keys', () => {
    let keys: Array<string | undefined>;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(FromConcept, FromMethod, Inherited);
        const app = await builder.build();
        try {
            const context = { correlationId: 'keys', allowedSeverity: 2, principal: undefined, tenantId: undefined,
                signal: new AbortController().signal };
            const results = await Promise.all([
                app.server.executeCommand('FromConcept', { id: 'concept' }, context),
                app.server.executeCommand('FromMethod', { id: 'field' }, context),
                app.server.executeCommand('Inherited', { id: 'inherited' }, context)
            ]);
            keys = results.map(result => result.response as string);
        } finally { await app.dispose(); }
    });
    it('should use the concept primitive, the method before the field, and inherited key', () => {
        keys.should.deep.equal(['concept', 'method', 'inherited']);
    });
});
describe('when a key is not a field', () => {
    let error: unknown;
    beforeEach(async () => {
        try { await ArcApplication.createBuilder().add(MissingField).build(); }
        catch (caught) { error = caught; }
    });
    it('should reject the command at build time', () => {
        (error as Error).message.should.contain('requires @field');
    });
});
describe('when key is marked twice', () => {
    let error: unknown;
    beforeEach(() => {
        try {
            class TwoKeys {
                @field(String) @key() first!: string;
                @field(String) @key() second!: string;
            }
            void TwoKeys;
        } catch (caught) { error = caught; }
    });
    it('should reject the second key', () => {
        (error as Error).message.should.contain('only one key');
    });
});
