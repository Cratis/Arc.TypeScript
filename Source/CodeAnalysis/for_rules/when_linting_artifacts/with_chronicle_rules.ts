// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { RuleTester } from '@typescript-eslint/rule-tester';
import parser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';
import { arcchr0003 } from '../../rules/arcchr0003.js';
import { arcchr0007 } from '../../rules/arcchr0007.js';
import { arcchr0010 } from '../../rules/arcchr0010.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parser, parserOptions: { ecmaVersion: 2022 } } });
const typed = new RuleTester({ languageOptions: { parser, parserOptions: {
    projectService: { allowDefaultProject: ['lint-fixture.ts'] }, tsconfigRootDir: process.cwd()
} } });
const filename = `${process.cwd()}/lint-fixture.ts`;
const reactor = "import { reactor } from '@cratis/chronicle/reactors';\n";
const command = "import { command } from '@cratis/arc.core';\n";
const chronicle = `import { eventType } from '@cratis/chronicle/events';
import { Guid } from '@cratis/fundamentals';
import { tuple, command, key } from '@cratis/arc.core';
import { eventSourceIdResponse } from '@cratis/arc.chronicle';
`;
const guid = "Guid.parse('00112233-4455-6677-8899-aabbccddeeff')";

tester.run('arcchr0003', arcchr0003, {
    valid: [
        `${reactor}@reactor('r') class R { handle() { return new Event(); } }`,
        `${reactor}@reactor('r') class R { handle() { this.store.outbox.append(event); } }`,
        `${reactor}@reactor('r') class R { handle() { this.store.eventLog.getTailSequenceNumber(); } }`,
        `${reactor}@reactor('r') class R { handle() { const store = anotherClient.getStore(); store.eventLog.append(event); } }`,
        `${reactor}@reactor('r') class R { handle() { const write = () => this.store.eventLog.append(event); return write; } }`,
        "import { reactor } from 'other'; @reactor('r') class R { handle() { this.store.eventLog.append(event); } }"
    ],
    invalid: [
        { code: `${reactor}@reactor('r') class R { handle() { this.store.eventLog.append(event); } }`,
            errors: [{ messageId: 'append' }] },
        { code: `${reactor}@reactor('r') class R { process() { this.store.eventLog.appendMany(events); } }`,
            errors: [{ messageId: 'append' }] },
        { code: `${reactor}@reactor('r') class R { async handle() {
            const store = await this.runtime.getStore(); await store.eventLog.append(event);
        } }`, errors: [{ messageId: 'append' }] }
    ]
});

tester.run('arcchr0007', arcchr0007, {
    valid: [
        `${command}@command() class C { handle() { return new Event(); } }`,
        `${command}@command() class C { provide() { this.store.eventLog.append(event); } handle() {} }`,
        `${command}@command() class C { handle() { this.store.outbox.append(event); } }`,
        "import { command } from 'other'; @command() class C { handle() { this.store.eventLog.append(event); } }"
    ],
    invalid: [
        { code: `${command}@command() class C { handle() { this.store.eventLog.append(event); } }`,
            errors: [{ messageId: 'append' }] },
        { code: `${command}@command() class C { async handle() { await this.store.eventLog.appendMany(events); } }`,
            errors: [{ messageId: 'append' }] },
        { code: `${command}@command() class C { async handle() {
            const store = await this.runtime.getStore(); await store.eventLog.append(event);
        } }`, errors: [{ messageId: 'append' }] }
    ]
});

typed.run('arcchr0010', arcchr0010, {
    valid: [
        { filename, code: `${chronicle}@eventType() class Created {}
            @command() class C { @key() id = ''; handle() { return tuple(${guid}, new Created()); } }` },
        { filename, code: `${chronicle}@eventType() class Created {}
            @command() class C { handle() { return tuple(eventSourceIdResponse('id'), new Created()); } }` },
        { filename, code: `${chronicle}@eventType() class Created {}
            @command() class C { getEventSourceId = () => 'id'; handle() { return tuple(${guid}, new Created()); } }` },
        { filename, code: `${chronicle}class Other {}
            @command() class C { handle() { return tuple(${guid}, new Other()); } }` },
        { filename, code: `${chronicle}@eventType() class Created {}
            @command() class C { handle() { return tuple('ordinary response', new Created()); } }` },
        { filename, code: `${chronicle}@eventType() class Created {}
            class Base { @key() id = ''; } @command() class C extends Base {
                handle() { return tuple(${guid}, new Created()); }
            }` }
    ],
    invalid: [{ filename, code: `${chronicle}@eventType() class Created {}
        @command() class C { handle() { return tuple(${guid}, new Created()); } }`, errors: [{ messageId: 'guid' }] }]
});
