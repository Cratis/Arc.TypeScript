// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'classify-changes.sh');

function classify(files) {
    const result = spawnSync('bash', [script], { input: files.join('\n'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return Object.fromEntries(result.stdout.trim().split('\n').map(line => line.split('=')));
}

test('when there are no changed files, nothing is selected', () => {
    assert.deepEqual(classify([]), { code: 'false', drizzle: 'false', tutorial: 'false', docs: 'false' });
});

test('when only blank lines are given, nothing is selected', () => {
    assert.deepEqual(classify(['', '']), { code: 'false', drizzle: 'false', tutorial: 'false', docs: 'false' });
});

test('when only documentation changed, only the documentation check is selected', () => {
    assert.deepEqual(classify(['README.md', 'Documentation/index.md']), { code: 'false', drizzle: 'false', tutorial: 'false', docs: 'true' });
});

test('when source changed, the complete gate is selected instead of the documentation check', () => {
    assert.deepEqual(classify(['Source/Chronicle/index.ts']), { code: 'true', drizzle: 'false', tutorial: 'false', docs: 'false' });
});

test('when core, drizzle and lock file changed, the matching integrations are selected', () => {
    const result = classify(['Source/Core/a.ts', 'Source/Drizzle/b.ts']);
    assert.equal(result.tutorial, 'true');
    assert.equal(result.drizzle, 'true');
    assert.equal(result.code, 'true');
});
