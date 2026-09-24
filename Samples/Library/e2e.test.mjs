// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { once } from 'node:events';
import { after, test } from 'node:test';
import { Guid } from '@cratis/fundamentals';
import { RegisterAuthor } from './Web/src/generated/Authors/Registration/RegisterAuthor.proxy.ts';
import { AuthorsPage } from './Web/src/generated/Authors/Listing/AuthorsPage.proxy.ts';
import { AllAuthors } from './Web/src/generated/Authors/Listing/AllAuthors.proxy.ts';
import { AddBook } from './Web/src/generated/Books/Registration/AddBook.proxy.ts';
import { BooksForAuthor } from './Web/src/generated/Books/Listing/BooksForAuthor.proxy.ts';

const socket = createServer();
socket.listen(0, '127.0.0.1');
await once(socket, 'listening');
const port = socket.address().port;
await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
const host = spawn(process.execPath, ['dist/main.js'], { cwd: import.meta.dirname,
    env: { ...process.env, PORT: String(port), MONGODB_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
host.stdout.on('data', chunk => { output += chunk; });
host.stderr.on('data', chunk => { output += chunk; });
after(async () => {
    host.kill('SIGTERM');
    if (host.exitCode === null && host.signalCode === null) await once(host, 'exit');
});

async function waitForServer() {
    for (let attempt = 0; attempt < 80; attempt++) {
        if (host.exitCode !== null || host.signalCode !== null) throw new Error(`Library exited: ${output}`);
        try { if ((await globalThis.fetch(`http://127.0.0.1:${port}/.cratis/commands`)).ok) return; }
        catch { /* Listener not ready yet. */ }
        await setTimeout(100);
    }
    throw new Error(`Library did not start: ${output}`);
}

test('generated client proxies register, page and relate a book over Express', { timeout: 15000 }, async () => {
    await waitForServer();
    const origin = `http://127.0.0.1:${port}`;
    const authorId = Guid.create();
    const author = new RegisterAuthor();
    author.setOrigin(origin);
    author.id = authorId;
    author.name = 'Octavia Butler';
    assert.equal((await author.execute()).isSuccess, true, output);
    const page = new AuthorsPage();
    page.setOrigin(origin);
    assert.equal((await page.perform()).data[0]?.name, 'Octavia Butler');
    const live = new AllAuthors();
    live.setOrigin(origin);
    assert.equal((await live.perform()).data[0]?.name, 'Octavia Butler');
    const addBook = new AddBook();
    addBook.setOrigin(origin);
    addBook.bookId = Guid.create();
    addBook.authorId = authorId;
    addBook.title = 'Kindred';
    assert.equal((await addBook.execute()).isSuccess, true, output);
    const books = new BooksForAuthor();
    books.setOrigin(origin);
    assert.equal((await books.perform({ authorId })).data[0]?.title, 'Kindred');
    const observed = new AllAuthors();
    observed.setOrigin(origin);
    let first;
    let updated;
    const emissions = [];
    const initial = new Promise(resolve => { first = resolve; });
    const next = new Promise(resolve => { updated = resolve; });
    const subscription = observed.subscribe(result => {
        emissions.push({ length: result.data?.length, success: result.isSuccess, changeSet: result.changeSet, exceptions: result.exceptionMessages });
        if (result.data.length === 1) first(result);
        if (result.changeSet?.added.some(author => author.name === 'N. K. Jemisin')) updated(result);
    });
    try {
        await Promise.race([initial, setTimeout(4000, undefined, { ref: false }).then(() => { throw new Error('No initial author emission'); })]);
        const second = new RegisterAuthor();
        second.setOrigin(origin);
        second.id = Guid.create();
        second.name = 'N. K. Jemisin';
        assert.equal((await second.execute()).isSuccess, true, output);
        assert.equal((await Promise.race([next, setTimeout(4000, undefined, { ref: false }).then(() => { throw new Error(`No live author update: ${JSON.stringify(emissions)}`); })])).changeSet.added[0].name, 'N. K. Jemisin');
    } finally { subscription.unsubscribe(); observed.dispose(); }
});
