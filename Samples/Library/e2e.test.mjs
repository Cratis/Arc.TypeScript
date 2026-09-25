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
import { RegisterAuthor } from './Web/src/generated/Authors/Registration/RegisterAuthor.proxy.js';
import { AuthorsPage } from './Web/src/generated/Authors/Listing/AuthorsPage.proxy.js';
import { AllAuthors } from './Web/src/generated/Authors/Listing/AllAuthors.proxy.js';
import { AddBook } from './Web/src/generated/Books/Registration/AddBook.proxy.js';

const socket = createServer();
socket.listen(0, '127.0.0.1');
await once(socket, 'listening');
const port = socket.address().port;
await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
const host = spawn(process.execPath, ['dist/main.js'], { cwd: import.meta.dirname,
    env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
host.stdout.on('data', chunk => { output += chunk; });
host.stderr.on('data', chunk => { output += chunk; });
after(async () => {
    host.kill('SIGTERM');
    if (host.exitCode === null && host.signalCode === null) {
        const stopped = once(host, 'exit');
        await Promise.race([stopped, setTimeout(2000)]);
        if (host.exitCode === null && host.signalCode === null) {
            host.kill('SIGKILL');
            await stopped;
        }
    }
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

test('generated client proxies register, page and relate a book over Express', { timeout: 30000 }, async () => {
    await waitForServer();
    const origin = `http://127.0.0.1:${port}`;
    const authorId = Guid.create();
    const author = new RegisterAuthor();
    author.setOrigin(origin);
    author.id = authorId;
    author.name = `Octavia Butler ${authorId}`;
    const registered = await author.execute();
    assert.equal(registered.isSuccess, true, `${JSON.stringify(registered)}; ${output}`);
    const page = new AuthorsPage();
    page.setOrigin(origin);
    const awaitResult = async (read, matches) => {
        let last;
        for (let attempt = 0; attempt < 60; attempt++) {
            const result = await read();
            last = result;
            if (matches(result)) return result;
            await setTimeout(250);
        }
        throw new Error(`Library projection did not catch up: ${JSON.stringify(last)}; ${output}`);
    };
    await awaitResult(() => page.perform(), result => result.data.some(item => item.name === author.name));
    const duplicate = new RegisterAuthor();
    duplicate.setOrigin(origin);
    duplicate.id = Guid.create();
    duplicate.name = author.name;
    const duplicateResult = await duplicate.execute();
    assert.equal(duplicateResult.isSuccess, false, 'Chronicle should reject a duplicate author name');
    assert.equal(duplicateResult.validationResults?.some(issue => issue.reason === 'constraintViolation'), true,
        JSON.stringify(duplicateResult));
    await awaitResult(() => globalThis.fetch(`${origin}/api/authors/listing/all-authors?waitForFirstResult=true`)
        .then(response => response.json()), result => result.data.some(item => item.name === author.name));
    const addBook = new AddBook();
    addBook.setOrigin(origin);
    addBook.bookId = Guid.create();
    addBook.authorId = authorId;
    addBook.title = 'Kindred';
    assert.equal((await addBook.execute()).isSuccess, true, output);
    await awaitResult(() => globalThis.fetch(`${origin}/api/books/listing/books-for-author?authorId=${authorId}&waitForFirstResult=true`)
        .then(response => response.json()), result => result.data.some(item => item.title === 'Kindred'));
    const secondName = `N. K. Jemisin ${Guid.create()}`;
    const observed = new AllAuthors();
    observed.setOrigin(origin);
    let first;
    let updated;
    const emissions = [];
    const initial = new Promise(resolve => { first = resolve; });
    const next = new Promise(resolve => { updated = resolve; });
    const subscription = observed.subscribe(result => {
        emissions.push({ length: result.data?.length, success: result.isSuccess, changeSet: result.changeSet, exceptions: result.exceptionMessages });
        if (result.data.some(item => item.name === author.name)) first(result);
        if (result.changeSet?.added.some(item => item.name === secondName)) updated(result);
    });
    try {
        await Promise.race([initial, setTimeout(4000, undefined, { ref: false }).then(() => { throw new Error('No initial author emission'); })]);
        const second = new RegisterAuthor();
        second.setOrigin(origin);
        second.id = Guid.create();
        second.name = secondName;
        assert.equal((await second.execute()).isSuccess, true, output);
        assert.equal((await Promise.race([next, setTimeout(12000, undefined, { ref: false }).then(() => { throw new Error(`No live author update: ${JSON.stringify(emissions)}`); })])).changeSet.added.some(item => item.name === secondName), true);
    } finally { subscription.unsubscribe(); observed.dispose(); }
});
