// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';

const base = `http://127.0.0.1:${Number(process.env.TUTORIAL_PORT)}`;
const author = '/api/authors/';
const books = '/api/books/';
const as = roles => {
    const payload = { identityProvider: 'local', userId: 'librarian', userDetails: 'Tutorial reader', userRoles: roles };
    return { 'x-ms-client-principal-id': 'librarian', 'x-ms-client-principal-name': 'Tutorial reader',
        'x-ms-client-principal': Buffer.from(JSON.stringify(payload)).toString('base64') };
};
const librarian = as(['Librarian']);
const reader = as([]);
async function request(path, headers = librarian, data) {
    const response = await fetch(base + path, { method: data ? 'POST' : 'GET',
        headers: { ...headers, ...(data ? { 'content-type': 'application/json' } : {}) },
        ...(data ? { body: JSON.stringify(data) } : {}) });
    const content = await response.text();
    let result;
    try { result = JSON.parse(content); } catch { result = content; }
    return { status: response.status, result };
}
const write = (path, payload, headers) => request(path, headers, payload);
const list = (path, headers) => request(path + (path.includes('?') ? '&' : '?') + 'waitForFirstResult=true', headers);
function ok(actual) {
    assert.equal(actual.status, 200, JSON.stringify(actual));
    assert.equal(actual.result.isSuccess, true, JSON.stringify(actual));
}
function denied(actual, status) {
    assert.equal(actual.status, status, JSON.stringify(actual));
    if (actual.result && typeof actual.result === 'object' && 'isAuthorized' in actual.result)
        assert.equal(actual.result.isAuthorized, false, JSON.stringify(actual));
}
const id = randomUUID();
const other = randomUUID();
const register = author + 'register-author';
const rename = author + 'rename-author';
const all = author + 'all-authors';
const add = books + 'add-book';
const forAuthor = books + 'books-for-author?authorId=' + id;
const forOther = books + 'books-for-author?authorId=' + other;
// Auth before writes: each command and query has a server-side role guard.
for (const [path, payload] of [[register, { id, name: 'Octavia Butler' }],
    [rename, { id, newName: 'Renamed' }], [add, { bookId: randomUUID(), authorId: id, title: 'Kindred' }]]) {
    denied(await write(path, payload, {}), 401);
    denied(await write(path, payload, reader), 403);
}
for (const path of [all, forAuthor]) {
    denied(await list(path, {}), 401);
    denied(await list(path, reader), 403);
}
console.log('PASS authorization 401/403 (register, rename, add, both queries)');
ok(await write(register, { id, name: 'Octavia Butler' }));
ok(await write(register, { id: other, name: 'Ursula Le Guin' }));
const authors = await list(all);
ok(authors);
assert.deepEqual(new Set(authors.result.data.map(item => item.name)), new Set(['Octavia Butler', 'Ursula Le Guin']));
console.log('PASS register and list authors');
const blank = await write(register, { id: randomUUID(), name: '' });
assert.equal(blank.status, 400, JSON.stringify(blank));
assert.match(JSON.stringify(blank.result.validationResults), /An author needs a name/);
const duplicate = await write(register, { id: randomUUID(), name: 'Octavia Butler' });
assert.equal(duplicate.status, 400, JSON.stringify(duplicate));
assert.match(JSON.stringify(duplicate.result.validationResults), /already registered/);
console.log('PASS blank and duplicate author rejections');
const bookId = randomUUID();
ok(await write(add, { bookId, authorId: id, title: 'Kindred' }));
ok(await write(add, { bookId: randomUUID(), authorId: other, title: 'Earthsea' }));
const catalog = await list(forAuthor);
ok(catalog);
assert.deepEqual(catalog.result.data.map(item => item.title), ['Kindred']);
const otherCatalog = await list(forOther);
ok(otherCatalog);
assert.deepEqual(otherCatalog.result.data.map(item => item.title), ['Earthsea']);
console.log('PASS add books and filtered catalogs');
// An observable query must publish a new snapshot on change (not merely fetch once).
const stream = await fetch(base + all, { headers: { ...librarian, accept: 'text/event-stream' } });
assert.equal(stream.status, 200);
const readerStream = stream.body.getReader();
const decoder = new TextDecoder();
let pendingFrames = '';
async function nextDataFrame(deadline, failure) {
    while (true) {
        const end = /\r?\n\r?\n/.exec(pendingFrames);
        if (end) {
            const frame = pendingFrames.slice(0, end.index);
            pendingFrames = pendingFrames.slice(end.index + end[0].length);
            const payload = frame.split(/\r?\n/).filter(line => line.startsWith('data:'))
                .map(line => line.slice(5).trimStart()).join('\n');
            if (!payload) continue; // Ignore keepalives, not the first data snapshot.
            try { return JSON.parse(payload); }
            catch { throw Error(`Observable query sent invalid JSON data frame: ${payload}`); }
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw Error(failure);
        const timer = new AbortController();
        let chunk;
        try {
            chunk = await Promise.race([
                readerStream.read(),
                pause(remaining, undefined, { signal: timer.signal }).then(() => { throw Error(failure); })
            ]);
        } finally { timer.abort(); }
        if (chunk.done) throw Error(`Observable query closed: ${failure}`);
        pendingFrames += decoder.decode(chunk.value, { stream: true });
    }
}
try {
    // A keepalive can precede the snapshot. Only write after a complete data frame.
    const fresh = 'N. K. Jemisin';
    const initial = await nextDataFrame(Date.now() + 30000, 'Observable query did not send an initial snapshot');
    assert.equal(initial.isSuccess, true, JSON.stringify(initial));
    assert.ok(Array.isArray(initial.data), `Invalid initial author snapshot: ${JSON.stringify(initial)}`);
    assert.ok(!initial.data.some(item => item.name === fresh), 'Fresh author already present in initial snapshot');
    ok(await write(register, { id: randomUUID(), name: fresh }));
    const deadline = Date.now() + 12000;
    while (true) {
        const update = await nextDataFrame(deadline, `Observable query did not publish a later data frame containing ${fresh}`);
        if (update.data?.some(item => item.name === fresh)) break;
    }
    console.log('PASS observable author update');
} finally { await readerStream.cancel(); }
// Authentication context changes still cannot bypass protected RenameAuthor.
assert.equal((await list(all, reader)).status, 403);
ok(await write(rename, { id, newName: 'Octavia E. Butler' }));
assert.equal((await list(all)).result.data.find(item => item.id === id)?.name, 'Octavia E. Butler');
console.log('PASS role-authorized RenameAuthor and list');
