// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { planRelease } from './plan.mjs';

const commit = 'a'.repeat(40);
const valid = {
    intent: 'minor',
    releaseNotes: '## Added\n- Support typed queries',
    tags: ['v1.2.3', 'v1.10.4', 'v1.9.9'],
    ref: 'refs/heads/main',
    sha: commit,
    headSha: commit,
    defaultBranch: 'main',
    npmPublishing: 'off'
};
const plan = changes => planRelease({ ...valid, ...changes });

test('minor preview increments the latest numeric tag, retains the user-facing notes, and has no effects', () => {
    const result = plan({});
    assert.equal(result.currentVersion, '1.10.4');
    assert.equal(result.tag, 'v1.11.0');
    assert.equal(result.notes, valid.releaseNotes);
    assert.equal(result.npmPublishing, 'off');
    assert.equal(result.effects, 'none');
    assert.match(result.versionBookkeeping, /unverified/);
});

test('patch preview begins at 0.0.0 when there are no tags', () => {
    assert.equal(plan({ intent: 'patch', tags: [] }).tag, 'v0.0.1');
});

test('multiple useful release-note sections are accepted', () => {
    assert.equal(plan({ releaseNotes: '## Added\n- Add queries\n\n## Fixed\n- Correct filter behavior' }).notes.includes('## Fixed'), true);
});

test('normalizes CRLF release notes to LF, including six supported sections', () => {
    const notes = ['Added', 'Changed', 'Fixed', 'Removed', 'Security', 'Deprecated']
        .map(section => `## ${section}\r\n- Explain the ${section.toLowerCase()} impact`)
        .join('\r\n\r\n');
    assert.equal(plan({ releaseNotes: notes }).notes, notes.replace(/\r\n/g, '\n'));
});

test('keeps TypeScript code spans, generics, and Markdown autolinks as text', () => {
    const notes = '## Added\n- Type `Result<T>` and use <https://example.com/guides> for examples';
    assert.equal(plan({ releaseNotes: notes }).notes, notes);
});

for (const intent of ['major', 'no-release', '', 'patch; npm publish']) {
    test(`rejects intent ${JSON.stringify(intent)}`, () => {
        assert.throws(() => plan({ intent }), /Only minor or patch/);
    });
}

for (const releaseNotes of ['', '  ', '## Added\n', '## Added\n- ', '## Added\n- TODO', '## Added\n- Add query\n## Breaking\n- Fix leak', '## Added\n- Add query\n## Added\n- Again', '## Fixed\n::warning file=notes.md,line=2::injected', '## Fixed\n- Real fix\n<!-- template instructions -->', '## Added\r- Invalid newline']) {
    test(`rejects absent, misleading or unsafe notes: ${JSON.stringify(releaseNotes)}`, () => {
        assert.throws(() => plan({ releaseNotes }), /Release notes|needs a user-facing|placeholder|unique|HTML comment|workflow command|Empty/);
    });
}

for (const bullet of [
    'Describe a new user-facing capability',
    'Describe a user-facing behavior change',
    'Describe a user-facing fix',
    'Describe what was removed for users',
    'Describe a user-facing security fix',
    'Describe the deprecated public API',
    'Describe a specific public capability that shipped',
    'Describe a specific user-visible bug that was fixed'
]) {
    test(`rejects the template/example bullet ${JSON.stringify(bullet)}`, () => {
        assert.throws(() => plan({ releaseNotes: `## Added\n- ${bullet}` }), /placeholder/);
    });
}

test('wrapper fails without a Git fixture on an invalid dispatch branch and keeps output on one log line', () => {
    const result = spawnSync(process.execPath, [new URL('../release-plan.mjs', import.meta.url).pathname], {
        encoding: 'utf8',
        env: { ...process.env, DEFAULT_BRANCH: 'main\n::error file=notes.md::injected' }
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'Release preview refused: "Invalid default branch"\n');
});

test('rejects disabled publishing being switched on', () => {
    assert.throws(() => plan({ npmPublishing: 'on' }), /must remain off/);
});

test('rejects injected, malformed, and prerelease tags', () => {
    for (const tags of [['v1.2.3;touch /tmp/x'], ['v01.2.3'], ['v1.2.3-beta.1'], ['1.2.3']]) {
        assert.throws(() => plan({ tags }), /Invalid stable version|Unexpected release tag/);
    }
});

test('rejects invalid expected version and unexpected tag state', () => {
    assert.throws(() => plan({ expectedCurrentVersion: '1.2.3;rm -rf .' }), /Invalid stable version/);
    assert.throws(() => plan({ expectedCurrentVersion: '1.10.3' }), /Expected 1.10.3/);
});

test('rejects unsafe ref or changed default branch head', () => {
    assert.throws(() => plan({ ref: 'refs/heads/feature' }), /default branch/);
    assert.throws(() => plan({ defaultBranch: 'main;echo hacked' }), /Invalid default branch/);
    assert.throws(() => plan({ headSha: 'b'.repeat(40) }), /current default-branch commit/);
    assert.throws(() => plan({ sha: 'bad' }), /current default-branch commit/);
});
