// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { RuleTester } from '@typescript-eslint/rule-tester';
import parser from '@typescript-eslint/parser';
import { afterAll, describe, it } from 'vitest';
import { arcchr0006 } from '../../rules/arcchr0006.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
const filename = `${process.cwd()}/lint-fixture.ts`;
const tester = new RuleTester({ languageOptions: { parser, parserOptions: {
    projectService: { allowDefaultProject: ['lint-fixture.ts'] }, tsconfigRootDir: process.cwd()
} }, defaultFilenames: { ts: filename, tsx: `${process.cwd()}/lint-fixture.tsx` } });
const imports = `import { reactor, onceOnly, replay } from '@cratis/chronicle/reactors';
import { eventType } from '@cratis/chronicle/events';
import { command } from '@cratis/arc.core';
@eventType() class BookReserved { isbn = ''; }
@eventType() class BookReturned { isbn = ''; }
@command() class DecreaseStock { constructor(public isbn = '') {} handle() {} }
`;
const fixture = (members: string, prefix = '@reactor()'): string => `${imports}${prefix} class StockKeeping { ${members} }`;
const invalid = (code: string, handlers = "'bookReserved'", line?: number) => ({ code, errors: [{ messageId: 'replay' as const,
    data: { handlers, handlerLabel: handlers.includes(' and ') ? 'handlers' : 'handler',
        action: handlers.includes(' and ') ? 'return' : 'returns' }, ...line && { line } }] });

tester.run('arcchr0006 when a reactor returns commands', arcchr0006, {
    valid: [
        fixture('@onceOnly() bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }'),
        fixture('bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }', '@onceOnly() @reactor()'),
        fixture(`bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }
            @replay() replayBookReserved(event: BookReserved) {}`),
        fixture(`bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }
            @replay(BookReserved) private onReplay(event: BookReserved) {}`),
        // Replay dispatch uses the method name rather than the TypeScript parameter annotation.
        fixture(`bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }
            @replay() replayBookReserved(event: BookReturned) {}`),
        fixture(`bookReserved(event: BookReserved) {}
            @replay() replayBookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }`),
        fixture(`@onceOnly() bookReserved(event: BookReserved) { return this.adjust(event.isbn); }
            @onceOnly() bookReturned(event: BookReturned) { return this.adjust(event.isbn); }
            private adjust(isbn: string) { return new DecreaseStock(isbn); }`),
        fixture('private unused(value: string) { return new DecreaseStock(value); }'),
        fixture('private bookReserved(value: string) { return new DecreaseStock(value); }'),
        fixture('bookReserved(event: BookReserved) { return event; }'),
        fixture('bookReserved(event: BookReserved) { return new Undecorated(); }') + '\nclass Undecorated {}',
        fixture('bookReserved(value: string) { return new DecreaseStock(value); }'),
        fixture('bookReserved(value: UnknownEvent) { return new DecreaseStock(value.isbn); }') +
            '\nclass UnknownEvent { isbn = ""; }',
        fixture('bookReserved(event: BookReserved) { return new Other(); } classMethod() {}') + '\nclass Other {}',
        fixture('bookReserved(event: BookReserved) {} private unrelated(event: BookReserved) { return new DecreaseStock(event.isbn); }'),
        fixture(`bookReserved(event: BookReserved) { this.adjust(event.isbn); }
            private adjust(isbn: string) { return new DecreaseStock(isbn); }`),
        fixture('bookReserved(event: BookReserved) { return [Promise.resolve(new DecreaseStock(event.isbn))]; }'),
        fixture('bookReserved(event: BookReserved) { return [[new DecreaseStock(event.isbn)]]; }'),
        `${imports}const StockKeeping = @onceOnly() @reactor() class {
            bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }
        };`,
        `${imports}class NotAReactor { bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); } }`,
        `import { reactor } from 'other'; ${imports}@reactor() class OtherReactor {
            bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); } }`,
        fixture('bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }',
            '@reactor() @onceOnly()')
    ],
    invalid: [
        invalid(fixture('bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }')),
        invalid(fixture(`bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }
            @replay() replayBookReturned(event: BookReturned) {}`)),
        invalid(`import { reactor as observe } from '@cratis/chronicle';
            import { eventType } from '@cratis/chronicle/events';
            import { command as arcCommand } from '@cratis/arc.core';
            @eventType() class Created {}
            @arcCommand() class C { handle() {} }
            @observe() class R { created(event: Created) { return new C(); } }`, "'created'"),
        invalid(fixture('private bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }')),
        invalid(fixture('bookReserved(event: BookReserved) { return [new DecreaseStock(event.isbn)]; }')),
        invalid(fixture('async bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }')),
        invalid(fixture('bookReserved(event: BookReserved) { return Promise.resolve([new DecreaseStock(event.isbn)]); }')),
        invalid(fixture('bookReserved(event: BookReserved) { return [this.adjust(event.isbn)]; } private adjust(isbn: string) { return new DecreaseStock(isbn); }')),
        invalid(fixture('bookReserved(event: BookReserved) { return [...this.adjust(event.isbn)]; } private adjust(isbn: string) { return [new DecreaseStock(isbn)]; }')),
        invalid(fixture(`bookReserved(event: BookReserved) { return this.ready ? this.adjust(event.isbn) : new DecreaseStock(event.isbn); }
            ready = true; private adjust(isbn: string) { return new DecreaseStock(isbn); }`), "'bookReserved'", 7),
        invalid(fixture(`async bookReserved(event: BookReserved) { return await this.adjust(event.isbn); }
            private async adjust(isbn: string) { return new DecreaseStock(isbn); }`)),
        invalid(`${imports}const StockKeeping = @reactor() class {
            bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }
        };`),
        invalid(fixture(`bookReserved(event: BookReserved) {
            const create = () => new DecreaseStock(event.isbn); return create(); }`)),
        invalid(fixture(`bookReserved(event: BookReserved) { return this.adjust(event.isbn); }
            private adjust(isbn: string) { return new DecreaseStock(isbn); }`)),
        invalid(fixture(`bookReserved(event: BookReserved) { return this.first(event.isbn); }
            private first(isbn: string) { return this.second(isbn); }
            private second(isbn: string) { return new DecreaseStock(isbn); }`)),
        invalid(fixture(`bookReserved(event: BookReserved) { return this.ready ? this.first(event.isbn) : this.second(event.isbn); }
            ready = true; private first(isbn: string) { return this.second(isbn); }
            private second(isbn: string) { return new DecreaseStock(isbn); }`)),
        invalid(fixture(`bookReserved(event: BookReserved) { return this.adjust(event.isbn); }
            bookReturned(event: BookReturned) { return this.adjust(event.isbn); }
            private adjust(isbn: string) { return new DecreaseStock(isbn); }`), "'bookReserved' and 'bookReturned'"),
        invalid(fixture(`bookReserved(event: BookReserved) { return new DecreaseStock(event.isbn); }
            @replay(BookReturned) other(event: BookReturned) {}`))
    ]
});
