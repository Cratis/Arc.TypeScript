// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { RuleTester } from '@typescript-eslint/rule-tester';
import parser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';
import { queryBinding } from '../../rules/queryBinding.js';
import { queryArgumentName } from '../../rules/queryArgumentName.js';
import { injectBinding } from '../../rules/injectBinding.js';
import { arc0003 } from '../../rules/arc0003.js';
import { arc0015 } from '../../rules/arc0015.js';
import { arc0002 } from '../../rules/arc0002.js';
import { arc0004 } from '../../rules/arc0004.js';
import { arc0014 } from '../../rules/arc0014.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
const filename = `${process.cwd()}/lint-fixture.ts`;
const tester = new RuleTester({ languageOptions: { parser, parserOptions: {
    projectService: { allowDefaultProject: ['lint-fixture.ts'] },
    tsconfigRootDir: process.cwd()
} } });
const legacy = new RuleTester({ languageOptions: { parser, parserOptions: {
    projectService: { allowDefaultProject: ['lint-fixture.ts'] },
    tsconfigRootDir: process.cwd(),
    compilerOptions: { experimentalDecorators: true, emitDecoratorMetadata: true }
} } });
const core = "import { command, readModel, query, argument, service, inject, validator, provided } from '@cratis/arc.core';\n";
const concepts = "import { ConceptAs } from '@cratis/fundamentals'; class Key extends ConceptAs<string> {}\n";
const classes = 'class Tasks { register(): void {} } class Other { other(): void {} }\n';

tester.run('arc0003', arc0003, {
    valid: [{ filename, code: `${core}${classes}@command() class Register { handle() {} } class External { handle(tasks: Tasks) {} }` },
        { filename, code: "import { command } from 'other'; @command() class Register {} class External { handle(command: Register) {} }" }],
    invalid: [{ filename, code: `${core}@command() class Register { handle() {} } class External { handle(command: Register) {} }`, errors: [{ messageId: 'external' }] },
        { filename, code: "import { command as cmd } from '@cratis/arc.core'; @cmd() class Register { handle() {} } class External { handle(command: Register) {} }", errors: [{ messageId: 'external' }] },
        { filename, code: "import * as arc from '@cratis/arc.core'; @arc.command() class Register { handle() {} } class External { handle(command: Register) {} }", errors: [{ messageId: 'external' }] }]
});
tester.run('arc0002', arc0002, {
    valid: [{ filename, code: `${core}@command() class Register { handle() {} } class External { title!: string; handle(command: Register) {} }` },
        { filename, code: "import { command as cmd } from '@cratis/arc.core'; @cmd() class Register { handle() {} } class External { title!: string; handle(command: Register) {} }" }],
    invalid: [{ filename, code: `${core}class Register { title!: string; handle() {} }`, errors: [{ messageId: 'missing' }] }]
});
tester.run('arc0004', arc0004, {
    valid: [{ filename, code: `${core}class Base { handle() {} } @command() class Register extends Base {}` }],
    invalid: [{ filename, code: `${core}@command() class Register { static handle() {} }`, errors: [{ messageId: 'missing' }] }]
});
tester.run('query-binding', queryBinding, {
    valid: [
        { filename, code: `${core}${concepts}${classes}@readModel() class Item { @query(argument('wireKey', Key), service(Tasks)) static byKey(key: Key, tasks: Tasks): Item { return new Item(); } }` },
        { filename, code: `${core}@readModel() class Item { @query(argument('key', String)) static byKey(key: string): Item { return new Item(); } }` }
    ],
    invalid: [
        { filename, code: `${core}${classes}@readModel() class Item { @query(service(Other)) static byKey(tasks: Tasks): Item { return new Item(); } }`, errors: [{ messageId: 'type' }] },
        { filename, code: `${core}${classes}@readModel() class Item { @query(service(Tasks)) static byKey(): Item { return new Item(); } }`, errors: [{ messageId: 'count' }] },
        { filename, code: `${core}@readModel() class Item { @query(argument('value', String), argument('limit', Number)) static byKey(value: string, limit = 10): Item { return new Item(); } }`, errors: [{ messageId: 'count' }] },
        { filename, code: "import * as arc from '@cratis/arc.core'; @arc.readModel() class Item { @arc.query(arc.argument('value', String)) static byKey() {} }", errors: [{ messageId: 'count' }] }
    ]
});
tester.run('opt-in query argument name', queryArgumentName, {
    valid: [{ filename, code: `${core}@readModel() class Item { @query(argument('id', String)) static byId(id: string) {} }` }],
    invalid: [{ filename, code: `${core}@readModel() class Item { @query(argument('wireId', String)) static byId(id: string) {} }`, errors: [{ messageId: 'name' }] }]
});
tester.run('inject-binding', injectBinding, {
    valid: [
        { filename, code: `${core}${classes}@command() class Register { @inject(Tasks) handle(tasks: Tasks) {} }` },
        { filename, code: `${core}${classes}@command() class Register { provide() { return 'a'; } @inject(Tasks) handle(value: string, tasks: Tasks) {} }` }
    ],
    invalid: [
        { filename, code: `${core}${classes}@command() class Register { @inject(Other) handle(tasks: Tasks) {} }`, errors: [{ messageId: 'type' }] },
        { filename, code: `${core}${classes}@command() class Register { @inject(Tasks) handle(value: string, tasks: Tasks) {} }`, errors: [{ messageId: 'count' }] },
        { filename, code: "import * as arc from '@cratis/arc.core'; @arc.command() class Register { @arc.inject(String) handle() {} }", errors: [{ messageId: 'count' }] }
    ]
});
legacy.run('inject-binding legacy decorators', injectBinding, {
    valid: [{ filename, code: `${core}class Repo<T> {} @command() class Register { @inject(Repo) handle(repo: Repo<string>) {} }` }], invalid: []
});
tester.run('arc0015', arc0015, {
    valid: [
        { filename, code: `${core}${concepts}@readModel() class Item { @query(argument('key', Key)) static byKey(key: Key) { return key; } }` },
        { filename, code: `${core}${concepts}@command() class Register { handle(key: string) { return new Key(key); } }` }
    ],
    invalid: [{ filename, code: `${core}${concepts}@readModel() class Item { @query(argument('key', String)) static byKey(key: string) { return new Key(key); } }`, errors: [{ messageId: 'concept' }] }]
});
tester.run('arc0014 aliased and namespace imports', arc0014, {
    valid: [{ filename, code: "import { query } from 'other'; class Item { @query() static all<T>() {} }" }],
    invalid: [
        { filename, code: "import { query as get } from '@cratis/arc.core'; class Item { @get() static all<T>() {} }", errors: [{ messageId: 'generic' }] },
        { filename, code: "import * as arc from '@cratis/arc.core'; class Item { @arc.query() static all<T>() {} }", errors: [{ messageId: 'generic' }] }
    ]
});
const untyped = new RuleTester({ languageOptions: { parser, parserOptions: { ecmaVersion: 2022 } } });
untyped.run('query-binding without type information', queryBinding, {
    valid: [`${core}@readModel() class Item { @query(argument('key', String)) static byKey(key: string) {} }`],
    invalid: [{ code: `${core}@readModel() class Item { @query(argument('key', String)) static byKey() {} }`, errors: [{ messageId: 'count' }] }]
});
untyped.run('external handlers without type information', arc0003, {
    valid: [`${core}@command() class Register { handle() {} } class External { handle(value: Register) {} }`], invalid: []
});
untyped.run('query concept checks without type information', arc0015, {
    valid: [`${core}${concepts}@readModel() class Item { @query(argument('key', String)) static byKey(key: string) { return new Key(key); } }`], invalid: []
});
untyped.run('inject-binding without type information', injectBinding, {
    valid: [`${core}@command() class Register { @inject(String) handle(value: string) {} }`], invalid: []
});
