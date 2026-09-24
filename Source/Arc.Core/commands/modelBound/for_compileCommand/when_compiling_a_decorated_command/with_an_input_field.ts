// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command } from '../../../../modelBound/decorators.js';
import { compileCommand } from '../../compileCommand.js';

@command()
class Register { @field(String) title!: string; handle(): string { return this.title; } }
describe('when compiling a decorated command with an input field', () => {
    let parsed: unknown;
    let name: string;
    beforeEach(() => {
        const compiled = compileCommand(Register, 'Samples');
        name = compiled.definition.name;
        parsed = compiled.definition.schema.parse({ title: 'Ada' });
    });
    it('should preserve the command name', () => { name.should.equal('Register'); });
    it('should bind the declared wire field', () => { (parsed as { title: string }).should.deep.equal({ title: 'Ada' }); });
});
