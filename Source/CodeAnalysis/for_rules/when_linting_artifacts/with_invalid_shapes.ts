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
const core = "import { command, readModel, query, inject, validator, CommandValidator, allowAnonymous, roles } from '@cratis/arc.core'; import { field } from '@cratis/fundamentals';\n";

tester.run('arc0002', arc0002, {
    valid: [
        `${core}@command() export class Register { @field(String) title!: string; handle() {} }`,
        'class Consumer { handle(message: string) {} }',
        'abstract class Base { title!: string; abstract handle(): void; }',
        'interface ICommandHandler { handle(): void; } class Handler implements ICommandHandler { title!: string; handle() {} }',
        'class Consumer { title!: string; static handle() {} }',
        "import { command } from 'other'; @command('deploy') class Deploy { title!: string; handle() {} }"
    ],
    invalid: [{ code: `${core}class Register { title!: string; handle() {} }`, errors: [{ messageId: 'missing' }] }]
});
tester.run('arc0004', arc0004, {
    valid: [`${core}@command() class Register { private handle() {} }`, `${core}class Base { handle() {} } @command() class Register extends Base {}`,
        "import { command } from 'other'; @command('deploy') class Deploy {}"],
    invalid: [{ code: `${core}@command() class Register {}`, errors: [{ messageId: 'missing' }] },
        { code: "import * as arc from '@cratis/arc.core'; @arc.command() class Register {}", errors: [{ messageId: 'missing' }] }]
});
tester.run('arc0005', arc0005, {
    valid: [`${core}@command() class Register { provide() { return 1; } handle(value: number) {} }`,
        `${core}@command() class Register { provide() { return void 0; } handle() {} }`,
        `${core}class Base { handle(value: number) {} } @command() class Register extends Base { provide() { return 1; } }`],
    invalid: [{ code: `${core}@command() class Register { provide() { return 1; } handle() {} }`, errors: [{ messageId: 'unused' }] }]
});
tester.run('arc0010', arc0010, {
    valid: [`${core}@command() class Register { async handle() { await work(); } }`,
        `${core}@command() class Register { async handle() { for await (const value of values) work(value); } }`,
        `${core}@command() class Register { async handle() { return work(); } }`],
    invalid: [{ code: `${core}@command() class Register { async handle() { return 1; } }`, errors: [{ messageId: 'unnecessary' }] }]
});
tester.run('arc0014', arc0014, {
    valid: [`${core}@readModel() class Item { @query() static all() { return []; } }`],
    invalid: [{ code: `${core}@readModel() class Item { @query() static all<T>() { return [] as T[]; } }`, errors: [{ messageId: 'generic' }] }]
});
tester.run('arc0012', arc0012, {
    valid: [`${core}@command() class Register { handle() { throw new DomainError(); } }`],
    invalid: [{ code: `${core}@command() class Register { handle() { throw Error('bad'); } }`, errors: [{ messageId: 'builtIn' }] }]
});
tester.run('arc0019', arc0019, {
    valid: [`${core}@roles('Admin') class Register { @allowAnonymous() handle() {} }`],
    invalid: [{ code: `${core}@allowAnonymous() @roles('Admin') class Register {}`, errors: [{ messageId: 'conflict' }] }]
});
tester.run('missing-field', missingField, {
    valid: [`${core}@command() class Register { @field(String) title!: string; private secret!: string; #internal = 1; handle() {} }`,
        "import { command } from '@cratis/arc.core'; import { field as f } from '@cratis/fundamentals'; @command() class Register { @f(String) title!: string; handle() {} }",
        "import { command } from 'other'; @command('deploy') class Deploy { title!: string; }"],
    invalid: [{ code: `${core}@command() class Register { title!: string; handle() {} }`, errors: [{ messageId: 'missing' }] },
        { code: "import * as arc from '@cratis/arc.core'; @arc.command() class Register { title!: string; handle() {} }", errors: [{ messageId: 'missing' }] }]
});
tester.run('declared-field', declaredField, {
    valid: [`${core}class Register { @field(String) title!: string; }`],
    invalid: [{ code: `${core}class Register { @field(String) declare title: string; }`, errors: [{ messageId: 'declared' }] },
        { code: "import { field as f } from '@cratis/fundamentals'; class Register { @f(String) declare title: string; }", errors: [{ messageId: 'declared' }] }]
});
tester.run('misplaced-decorator', misplacedDecorator, {
    valid: [`${core}@readModel() class Item { @query() static all() { return []; } }`,
        `${core}@command() class Register { @inject(String) provide(value: string) {} handle() {} }`,
        "import { inject } from 'other'; class Samurai { @inject(String) sword!: string; }"],
    invalid: [{ code: `${core}class Item { @query() static all() { return []; } }`, errors: [{ messageId: 'misplaced' }] },
        { code: "import * as arc from '@cratis/arc.core'; class Item { @arc.query() static all() { return []; } }", errors: [{ messageId: 'misplaced' }] }]
});
tester.run('validator-target', validatorTarget, {
    valid: [`${core}@validator(String) class Check extends CommandValidator<string> {}`,
        "import { CommandValidator } from 'other'; class Check extends CommandValidator {}"],
    invalid: [{ code: `${core}class Check extends CommandValidator<string> {}`, errors: [{ messageId: 'missing' }] },
        { code: "import { CommandValidator as CV } from '@cratis/arc.core'; class Check extends CV<string> {}", errors: [{ messageId: 'missing' }] }]
});
tester.run('unexported-artifact', unexportedArtifact, {
    valid: [`${core}@command() class Register { handle() {} } export { Register };`],
    invalid: [{ code: `${core}@command() class Register { handle() {} }`, errors: [{ messageId: 'hidden' }] },
        { code: "import { command as cmd } from '@cratis/arc.core'; @cmd() class Register { handle() {} }", errors: [{ messageId: 'hidden' }] }]
});
