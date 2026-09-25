// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { command, commandReadModel, inject, key } from '@cratis/arc.core';
import { field } from '@cratis/fundamentals';
import { given } from '../../given.js';
import { a_sqlite_database } from '../../for_DrizzleReadModels/given/a_sqlite_database.js';
import { a_builder } from '../../for_withDrizzle/given/a_builder.js';
import '../../index.js';

should();
class TitleOnly { @field(String) title!: string; }
@command()
class RenameTitle {
    @field(String) @key() id!: string;
    @inject(commandReadModel(TitleOnly))
    handle(model: TitleOnly): string { return model.title; }
}
describe('when injecting a model without a declared key field', given(a_builder, context => {
    const sqlite = new a_sqlite_database();
    let failure: Error | undefined;
    beforeEach(async () => {
        context.builder.withDrizzle({ dialect: 'sqlite', database: {}, readModels: [{ type: TitleOnly, table: sqlite.table }] });
        context.builder.add(RenameTitle);
        failure = await context.builder.build().then(() => undefined, reason => reason as Error);
    });
    it('should report that no resolver claims the model at build', () => {
        should().exist(failure);
        failure!.message.should.equal('Expected one read-model resolver for TitleOnly, found 0');
    });
}));
