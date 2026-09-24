// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderRecordedRules } from '../../renderRecordedRules.js';

describe('when rendering portable rules with a server-only rule', () => {
    let rendered: string;
    let diagnostics: string[];
    beforeEach(() => {
        diagnostics = [];
        rendered = renderRecordedRules('RegisterTask', 'CommandValidator', 'IRegisterTask', [
            { path: ['title'], kind: 'notEmpty', args: [], clientSafe: true },
            { path: ['title'], kind: 'mustAsync', args: [], clientSafe: false }
        ], message => diagnostics.push(message));
    });
    it('should retain the portable rule', () => {
        rendered.should.contain('this.ruleFor(c => c.title).notEmpty();');
    });
    it('should report the rule that cannot run in the client', () => {
        diagnostics.should.deep.equal(['Server-only validation rule on RegisterTask.title: mustAsync']);
    });
});
