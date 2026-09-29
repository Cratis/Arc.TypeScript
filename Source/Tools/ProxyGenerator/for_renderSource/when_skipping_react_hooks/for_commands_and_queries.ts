// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderSource } from '../../renderSource.js';
import { a_captured_contract } from '../given/a_captured_contract.js';

describe('when skipping react hooks for commands and queries', () => {
    let files: ReadonlyMap<string, string>;
    beforeEach(() => { files = renderSource(new a_captured_contract().analysis, { skipReactHooks: true }); });
    it('should not import react from any generated file', () => {
        for (const text of files.values()) text.should.not.include('@cratis/arc.react');
    });
    it('should not emit use hooks on the command', () => {
        files.get('differential/fixture/commands/CreateFixtures.ts')!.should.not.match(/static use/);
    });
    it('should not emit hooks or when on the queries', () => {
        for (const name of ['All', 'Observe', 'Search'])
            files.get(`differential/fixture/models/${name}.ts`)!.should.not.match(/static (use|when)/);
    });
    it('should keep the typed client classes', () => {
        files.get('differential/fixture/commands/CreateFixtures.ts')!.should.include("import { Command } from '@cratis/arc/commands';");
        files.get('differential/fixture/commands/CreateFixtures.ts')!.should.include('export class CreateFixtures extends Command<');
        files.get('differential/fixture/models/Observe.ts')!.should.include('export class Observe extends ObservableQueryFor<');
    });
    it('should keep the sorting helpers for array queries', () => {
        files.get('differential/fixture/models/All.ts')!.should.include('static get sortBy()');
    });
});
