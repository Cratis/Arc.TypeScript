// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderSource } from '../../renderSource.js';
import { a_captured_contract } from '../given/a_captured_contract.js';

describe('when rendering with react hooks by default', () => {
    let files: ReadonlyMap<string, string>;
    beforeEach(() => { files = renderSource(new a_captured_contract().analysis); });
    it('should import the react command hook', () => {
        files.get('differential/fixture/commands/CreateFixtures.ts')!.should.include("from '@cratis/arc.react/commands';");
        files.get('differential/fixture/commands/CreateFixtures.ts')!.should.include('static use(initialValues?: ICreateFixtures)');
    });
    it('should import the react query hooks', () => {
        files.get('differential/fixture/models/All.ts')!.should.include("from '@cratis/arc.react/queries';");
        files.get('differential/fixture/models/All.ts')!.should.include('static use(');
        files.get('differential/fixture/models/All.ts')!.should.include('static when(');
    });
});
