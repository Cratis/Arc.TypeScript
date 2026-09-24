// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import ts from 'typescript';
import { warningOption } from '../../sourceOperationOptions.js';

const expression = (source: string): ts.Expression => {
    const file = ts.createSourceFile('options.ts', `${source};`, ts.ScriptTarget.Latest, true);
    return (file.statements[0] as ts.ExpressionStatement).expression;
};
describe('when reading dynamic decorator options', () => {
    for (const option of ['command(settings)', 'command(makeOptions())', 'query(makeOptions())', 'command({ treatWarningsAsErrors })', 'command({ ...settings })',
        'command({ namespace: prefix })', 'query({ observable: enabled })']) {
        it(`should reject ${option}`, () => {
            (() => warningOption(expression(option))).should.throw(/static|literal/);
        });
    }
});
