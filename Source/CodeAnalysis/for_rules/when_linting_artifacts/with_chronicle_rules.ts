// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { RuleTester } from '@typescript-eslint/rule-tester';
import parser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';
import { arcchr0003 } from '../../rules/arcchr0003.js';
import { arcchr0007 } from '../../rules/arcchr0007.js';
import { arcchr0009 } from '../../rules/arcchr0009.js';
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
        `${reactor}@reactor('r') class R { handle() { this.store.eventLog.append(event); } }`,
        `${reactor}@reactor('r') class R { store = other.getEventStore('elsewhere'); handle() { this.store.eventLog.append(event); } }`,
        `${reactor}@reactor('r') class R { async handle() {
            this.store = await other.getEventStore('elsewhere'); await this.store.eventLog.append(event);
        } }`,
        `${reactor}@reactor('r') class R { handle() { const store = anotherClient.getStore(); store.eventLog.append(event); } }`,
        `${reactor}@reactor('r') class R { handle() { const write = () => this.store.eventLog.append(event); return write; } }`,
        "import { reactor } from 'other'; @reactor('r') class R { handle() { this.store.eventLog.append(event); } }"
    ],
    invalid: [
        { code: `${reactor}@reactor('r') class R { store = this.client.getEventStore('own'); handle() { this.store.eventLog.append(event); } }`,
            errors: [{ messageId: 'append' }] },
        { code: `import { reactor } from '@cratis/chronicle'; @reactor('r') class R {
            store = this.runtime.getStore(); process() { this.store.eventLog.transactional.appendMany(events); } }`,
            errors: [{ messageId: 'append' }] },
        { code: `${reactor}@reactor('r') class R { async handle() {
            this.store = await this.client.getEventStore('own'); await this.store.eventLog.append(event);
        } }`, errors: [{ messageId: 'append' }] }
    ]
});

tester.run('arcchr0007', arcchr0007, {
    valid: [
        `${command}@command() class C { handle() { return new Event(); } }`,
        `${command}@command() class C { provide() { const store = other.getStore(); store.eventLog.append(event); } handle() {} }`,
        `import { command, inject } from '@cratis/arc.core'; import { ChronicleRuntime } from '@cratis/arc.chronicle';
            @command() class C { @inject(String, ChronicleRuntime) async handle(other, runtime) {
                const store = await other.getStore(); await store.eventLog.append(event);
            } }`,
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
        } }`, errors: [{ messageId: 'append' }] },
        { code: `${command}@command() class C { provide() { this.store.eventLog.append(event); } handle() {} }`,
            errors: [{ messageId: 'append' }] },
        { code: `import { inject, command } from '@cratis/arc.core';
            import { ChronicleReadModels } from '@cratis/arc.chronicle';
            @command() class C { @inject(ChronicleReadModels) async handle(models) {
                const store = await models.getStore(); await store.eventLog.transactional.append(event);
            } }`, errors: [{ messageId: 'append' }] },
        { code: `import { inject, command } from '@cratis/arc.core';
            import { ChronicleRuntime } from '@cratis/arc.chronicle';
            @command() class C { @inject(ChronicleRuntime) async provide(runtime) {
                await (await runtime.getStore()).eventLog.append(event);
            } handle() {} }`, errors: [{ messageId: 'append' }] }
    ]
});

tester.run('arcchr0009', arcchr0009, {
    valid: [
        `${command}@command() class C { password = ''; secretKey = ''; accessToken = ''; apiKey = ''; }`,
        `${command}@command() class C { passenger = ''; pinCount = 0; }`,
        `import { command } from '@cratis/arc.core'; import { notAudited } from '@cratis/arc.chronicle';
            @command() class C { @notAudited() passphrase = ''; }`,
        `import { command } from '@cratis/arc.core'; import { pii } from '@cratis/chronicle/compliance';
            @command() class C { @pii() accessKey = ''; }`,
        `class C { passphrase = ''; }`
    ],
    invalid: [
        { code: `${command}@command() class C { passphrase = ''; privateKey = ''; accessKey = ''; }`,
            errors: [{ messageId: 'secret' }, { messageId: 'secret' }, { messageId: 'secret' }] },
        { code: `${command}@command() class C { pin = ''; otp = ''; cvv = ''; cvc = ''; securityCode = ''; authorizationHeader = ''; }`,
            errors: Array.from({ length: 6 }, () => ({ messageId: 'secret' as const })) }
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
    invalid: [
        { filename, code: `${chronicle}@eventType() class Created {}
            @command() class C { handle() { return tuple(${guid}, new Created()); } }`, errors: [{ messageId: 'guid' }] },
        { filename, code: `${chronicle}@eventType() class Created {}
            @command() class C { handle() { return tuple(Guid.create(), new Created()); } }`, errors: [{ messageId: 'guid' }] },
        { filename, code: `${chronicle}@eventType() class Created {}
            @command() class C { handle() { const id = Guid.create(); return tuple(id, new Created()); } }`, errors: [{ messageId: 'guid' }] },
        { filename, code: `import { eventType } from '@cratis/chronicle';
            import { Guid } from '@cratis/fundamentals'; import { command, tuple } from '@cratis/arc.core';
            @eventType() class Created {} @command() class C { handle() { return tuple(Guid.create(), new Created()); } }`,
            errors: [{ messageId: 'guid' }] },
        { filename, code: `import { eventType } from '@cratis/chronicle/events';
            import * as Fundamentals from '@cratis/fundamentals'; import { command, tuple } from '@cratis/arc.core';
            @eventType() class Created {} @command() class C { handle() { return tuple(Fundamentals.Guid.create(), new Created()); } }`,
            errors: [{ messageId: 'guid' }] }
    ]
});
