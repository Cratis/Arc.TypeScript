// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { fromEvent } from '@cratis/chronicle/projections';
import { ArcApplication, command, commandReadModel, inject, key, readModel } from '@cratis/arc.core';
import type { ClassType, ReadModelForCommandResolver } from '@cratis/arc.core';
import type { IChronicleClient } from '@cratis/chronicle';
import '../../index.js';

@eventType() class Added { @field(String) name = ''; }
@readModel() @fromEvent(Added) class View { @field(String) id = ''; }
@command() class ReadView {
    @field(String) @key() id = '';
    @inject(commandReadModel(View)) handle(view: View) { return view.id; }
}
class CompetingResolver implements ReadModelForCommandResolver {
    supports(type: ClassType): boolean { return type === View; }
    async find<T>(): Promise<T | null> { return null; }
}

describe('when building a command with a read-model binding', () => {
    it('should reject a missing owner before serving commands', async () => {
        const builder = ArcApplication.createBuilder();
        builder.add(ReadView, View);
        let error: unknown;
        try { await builder.build(); } catch (caught) { error = caught; }
        String(error).should.contain('Expected one read-model resolver for View, found 0');
    });
    it('should reject two owners before serving commands', async () => {
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Views', client: { getEventStore: async () => { throw new Error('Unexpected connection'); } } as unknown as IChronicleClient });
        builder.services.addScoped(CompetingResolver);
        builder.addReadModelForCommandResolver(CompetingResolver);
        builder.add(ReadView, View, Added);
        let error: unknown;
        try { await builder.build(); } catch (caught) { error = caught; }
        String(error).should.contain('Expected one read-model resolver for View, found 2');
    });
});
