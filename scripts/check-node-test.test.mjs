// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test, after } from 'node:test';
import { command } from '@cratis/arc.core';
import { field } from '@cratis/fundamentals';
import { CommandScenario } from '@cratis/arc.testing';

const archived = [];
class ArchiveTask {
    handle() { archived.push(this.id); }
}
field(String)(ArchiveTask.prototype, 'id');
command()(ArchiveTask);

const scenario = CommandScenario.for(ArchiveTask);
after(async () => { await scenario.dispose(); });

test('when archiving a task, the command pipeline executes its handler', async () => {
    const result = await scenario.execute({ id: 't-1' });
    result.shouldBeSuccessful();
    if (archived.length !== 1 || archived[0] !== 't-1') throw Error('Task was not archived');
});
