// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '../../index.js';
import { given } from '../../given.js';
import { Tasks } from '../../../../Samples/Tasks/Features/Tasks/Tasks.js';
import { metadata } from '../../../../Samples/Tasks/Features/generatedMetadata.js';

class a_tasks_discovery {
    createBuilder() {
        const builder = ArcApplication.createBuilder();
        builder.useGeneratedMetadata(metadata);
        builder.services.addSingleton(Tasks);
        return builder;
    }
}

describe('when discovering several exports from each task slice', given(a_tasks_discovery, context => {
    let names: string[];
    beforeEach(async () => {
        const builder = context.createBuilder();
        await builder.discover(new URL('../../../../Samples/Tasks/Features/', import.meta.url));
        const application = await builder.build();
        try {
            names = [...application.server.commands.map(item => item.name),
                ...application.server.queries.map(item => item.name)];
        } finally { await application.dispose(); }
    });
    it('should register the command and read-model operations from their slice modules', () => {
        names.should.include('RegisterTask').and.include('allTasks');
    });
    it('should not register the co-located validator as a command', () => {
        names.should.not.include('RegisterTaskValidator');
    });
}));
