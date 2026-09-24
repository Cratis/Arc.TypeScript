// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { RuleTester } from '@typescript-eslint/rule-tester';
import parser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';
import { queryBinding } from '../../rules/queryBinding.js';
import { injectBinding } from '../../rules/injectBinding.js';
import { arc0003 } from '../../rules/arc0003.js';
import { arc0013 } from '../../rules/arc0013.js';
import { arc0015 } from '../../rules/arc0015.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parser, parserOptions: {
    projectService: { allowDefaultProject: ['lint-fixture.ts'] },
    tsconfigRootDir: process.cwd()
} } });
const filename = `${process.cwd()}/lint-fixture.ts`;
const prelude = `declare function query(...tokens: unknown[]): MethodDecorator;
declare function argument(name: string, token: unknown): unknown;
declare function service(token: unknown): unknown;
declare function inject(...tokens: unknown[]): MethodDecorator;
declare function command(): ClassDecorator;
declare function readModel(): ClassDecorator;
declare function validator(token: unknown): ClassDecorator;
declare class ConceptAs<T> { constructor(value: T); }
class Key extends ConceptAs<string> {}
class Tasks { register(): void {} }
class Other { other(): void {} }
`;

tester.run('arc0003', arc0003, {
    valid: [{ filename, code: `${prelude} @command() class Register { handle() {} } class External { handle(tasks: Tasks) {} }` }],
    invalid: [{ filename, code: `${prelude} @command() class Register { handle() {} } class External { handle(command: Register) {} }`, errors: [{ messageId: 'external' }] }]
});

tester.run('query-binding', queryBinding, {
    valid: [
        { filename, code: `${prelude} @readModel() class Item { @query(argument('key', Key), service(Tasks)) static byKey(key: Key, tasks: Tasks): Item { return new Item(); } }` },
        { filename, code: `${prelude} @readModel() class Item { @query(argument('key', String)) static byKey(key: string): Item { return new Item(); } }` }
    ],
    invalid: [
        { filename, code: `${prelude} @readModel() class Item { @query(argument('wrong', Key)) static byKey(key: Key): Item { return new Item(); } }`, errors: [{ messageId: 'name' }] },
        { filename, code: `${prelude} @readModel() class Item { @query(service(Other)) static byKey(tasks: Tasks): Item { return new Item(); } }`, errors: [{ messageId: 'type' }] },
        { filename, code: `${prelude} @readModel() class Item { @query(service(Tasks)) static byKey(): Item { return new Item(); } }`, errors: [{ messageId: 'count' }] }
    ]
});
tester.run('inject-binding', injectBinding, {
    valid: [{ filename, code: `${prelude} @command() class Register { @inject(Tasks) handle(tasks: Tasks) {} }` }],
    invalid: [{ filename, code: `${prelude} @command() class Register { @inject(Other) handle(tasks: Tasks) {} }`, errors: [{ messageId: 'type' }] }]
});
tester.run('arc0013', arc0013, {
    valid: [{ filename, code: `${prelude} @validator(Key) class Check { ruleFor(fn: (value: { key: Key }) => unknown) {} check() { this.ruleFor(value => value.key); } }` }],
    invalid: [{ filename, code: `${prelude} @validator(Key) class Check { ruleFor(fn: (value: { key: Key }) => unknown) {} check() { this.ruleFor(value => value.key.value); } }`, errors: [{ messageId: 'dereference' }] }]
});
tester.run('arc0015', arc0015, {
    valid: [{ filename, code: `${prelude} @readModel() class Item { @query(argument('key', Key)) static byKey(key: Key) { return key; } }` }],
    invalid: [{ filename, code: `${prelude} @readModel() class Item { @query(argument('key', String)) static byKey(key: string) { return new Key(key); } }`, errors: [{ messageId: 'concept' }] }]
});
