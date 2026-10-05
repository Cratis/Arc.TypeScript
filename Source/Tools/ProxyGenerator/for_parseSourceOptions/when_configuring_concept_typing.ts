// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { parseSourceOptions } from '../parseSourceOptions.js';

const required = ['--project', '/tsconfig.json', '--artifacts', '/src', '--output', '/out'];
describe('when configuring scalar typing of concept subclasses', () => {
    it('should be off by default', () => parseSourceOptions(required, '').configuration.scalarConceptSubclasses!.should.be.false);
    it('should be on with the flag', () =>
        parseSourceOptions([...required, '--scalar-concept-subclasses'], '').configuration.scalarConceptSubclasses!.should.be.true);
});
