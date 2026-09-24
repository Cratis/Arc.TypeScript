// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { RuleTester } from '@typescript-eslint/rule-tester';
import parser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';
import { arc0002 } from '../../rules/arc0002.js';
import { arc0004 } from '../../rules/arc0004.js';
import { arc0005 } from '../../rules/arc0005.js';
import { arc0010 } from '../../rules/arc0010.js';
import { arc0014 } from '../../rules/arc0014.js';
import { arc0012 } from '../../rules/arc0012.js';
import { arc0019 } from '../../rules/arc0019.js';
import { missingField } from '../../rules/missingField.js';
import { declaredField } from '../../rules/declaredField.js';
import { misplacedDecorator } from '../../rules/misplacedDecorator.js';
import { validatorTarget } from '../../rules/validatorTarget.js';
import { unexportedArtifact } from '../../rules/unexportedArtifact.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parser, parserOptions: { ecmaVersion: 2022 } } });

tester.run('arc0002', arc0002, {
    valid: ['@command() export class Register { handle() {} }'],
    invalid: [{ code: 'class Register { handle() {} }', errors: [{ messageId: 'missing' }] }]
});
tester.run('arc0004', arc0004, {
    valid: ['@command() class Register { handle() {} }'],
    invalid: [
        { code: '@command() class Register {}', errors: [{ messageId: 'missing' }] },
        { code: '@command() class Register { private handle() {} }', errors: [{ messageId: 'missing' }] }
    ]
});
tester.run('arc0005', arc0005, {
    valid: ['@command() class Register { provide() { return new Tasks(); } handle(tasks: Tasks) {} }', '@command() class Register { provide() { return rejected([]); } handle() {} }'],
    invalid: [{ code: '@command() class Register { provide() { return new Tasks(); } handle() {} }', errors: [{ messageId: 'unused' }] }]
});
tester.run('arc0010', arc0010, {
    valid: ['@command() class Register { async handle() { await work(); } }'],
    invalid: [{ code: '@command() class Register { async handle() { return 1; } }', errors: [{ messageId: 'unnecessary' }] }]
});
tester.run('arc0014', arc0014, {
    valid: ['@readModel() class Item { @query() static all() { return []; } }'],
    invalid: [{ code: '@readModel() class Item { @query() static all<T>() { return [] as T[]; } }', errors: [{ messageId: 'generic' }] }]
});
tester.run('arc0012', arc0012, {
    valid: ['@command() class Register { handle() { throw new DomainError(); } }'],
    invalid: [{ code: '@command() class Register { handle() { throw new Error("bad"); } }', errors: [{ messageId: 'builtIn' }] }]
});
tester.run('arc0019', arc0019, {
    valid: ['@roles("Admin") class Register { @allowAnonymous() handle() {} }'],
    invalid: [{ code: '@allowAnonymous() @roles("Admin") class Register {}', errors: [{ messageId: 'conflict' }] }]
});
tester.run('missing-field', missingField, {
    valid: ['@command() class Register { @field(String) title!: string; handle() {} }'],
    invalid: [{ code: '@command() class Register { title!: string; handle() {} }', errors: [{ messageId: 'missing' }] }]
});
tester.run('declared-field', declaredField, {
    valid: ['class Register { @field(String) title!: string; }'],
    invalid: [{ code: 'class Register { @field(String) declare title: string; }', errors: [{ messageId: 'declared' }] }]
});
tester.run('misplaced-decorator', misplacedDecorator, {
    valid: ['@readModel() class Item { @query() static all(): Item[] { return []; } }'],
    invalid: [{ code: 'class Item { @query() static all(): Item[] { return []; } }', errors: [{ messageId: 'misplaced' }] }]
});
tester.run('validator-target', validatorTarget, {
    valid: ['@validator(Register) class Check extends CommandValidator<Register> {}'],
    invalid: [{ code: 'class Check extends CommandValidator<Register> {}', errors: [{ messageId: 'missing' }] }]
});
tester.run('unexported-artifact', unexportedArtifact, {
    valid: ['@command() class Register { handle() {} } export { Register };'],
    invalid: [{ code: '@command() class Register { handle() {} }', errors: [{ messageId: 'hidden' }] }]
});
