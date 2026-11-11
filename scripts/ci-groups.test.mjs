// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

// Deliberately pinned: editing both the groups and this list is required to remove a check from the gate.
const originalCommands = [
    'yarn tsc -b Source/Core Source/Testing Source/Chronicle Source/MongoDB Source/Tools/ProxyGenerator',
    'yarn check:metadata',
    'yarn workspace @cratis/arc.core.sample.tasks generate-proxies',
    'yarn workspace @cratis/arc.sample.library generate-proxies',
    'yarn workspace @cratis/arc.sample.showcase generate-proxies',
    'yarn check:proxies',
    'yarn build',
    'yarn check:declarations',
    'yarn check:declarations:self-test',
    'yarn check:consumers',
    'yarn check:chronicle-peer-floor:self-test',
    'yarn check:chronicle-peer-floor',
    'yarn check:fetch',
    'yarn check:node-test',
    'yarn check:observability-recipes',
    'yarn workspace @cratis/arc.sample.library.web build',
    'yarn lint',
    'yarn typecheck',
    'yarn lint:tasks:arc',
    'yarn test:client-generation:verify',
    'yarn test',
    'yarn workspace @cratis/arc.sample.library test:e2e',
    'yarn test:legacy-decorators',
    'yarn test:decorator-types',
    'yarn docs:lint',
    'yarn docs:snippets:self-test',
    'yarn docs:snippets',
    'yarn docs:examples:self-test',
    'yarn docs:examples',
    'node --test scripts/for_release/*.test.mjs',
    'node --test scripts/classify-changes.test.mjs',
    'yarn set-version --check'
];
const groups = ['artifacts', 'quality', 'tests', 'specs', 'docs'];
const guard = 'node --test scripts/ci-groups.test.mjs';
const commands = script => script.split(' && ');
// Accepts only the workflow's simple, explicit job layout, not arbitrary YAML.
const jobEntries = [...workflow.matchAll(/^  ([\w-]+):\n([\s\S]*?)(?=^  [\w-]+:\n|$(?![\s\S]))/gm)]
    .map(([, id, body]) => [id, body]);
const jobs = Object.fromEntries(jobEntries);

test('the complete local gate runs every original command exactly once, plus this guard', () => {
    assert.deepEqual(commands(scripts.ci), groups.map(group => `yarn ci:${group}`));
    const grouped = groups.flatMap(group => commands(scripts[`ci:${group}`]));
    assert.deepEqual(grouped.toSorted(), [...originalCommands, guard].toSorted());
    assert.equal(new Set(grouped).size, grouped.length);
    assert.equal(scripts['ci:specs'], 'yarn test');
});

test('CI runs every group as its own job when code changes', () => {
    assert.equal(Object.keys(jobs).length, jobEntries.length, 'duplicate job ids');
    assert.deepEqual(Object.keys(jobs).filter(id => id.startsWith('verify-')).sort(),
        groups.map(group => `verify-${group}`).sort());
    for (const group of groups) {
        const job = jobs[`verify-${group}`];
        assert.match(job, /^    needs: changes$/m);
        assert.deepEqual([...job.matchAll(/^\s+if: (.+)$/gm)].map(([, condition]) => condition),
            ["needs.changes.outputs.code == 'true'"]);
        assert.doesNotMatch(job, /continue-on-error/);
        const run = `yarn ci:${group}${group === 'specs' ? ' --shard=${{ matrix.shard }}' : ''}`;
        const steps = [...job.matchAll(/^        run: (.+)$/gm)].map(([, command]) => command);
        assert.equal(steps.at(-1), run);
        assert.ok(steps.includes('yarn install --immutable'));
    }
});

test('the spec shards cover the whole suite exactly once and never cancel each other', () => {
    const specs = jobs['verify-specs'];
    assert.match(specs, /^      fail-fast: false$/m);
    const matrix = specs.match(/^        shard: \[([^\]]+)\]$/m);
    assert.ok(matrix, 'verify-specs must declare a shard matrix');
    const shards = matrix[1].split(', ').map(shard => shard.replaceAll("'", ''));
    const total = shards.length;
    assert.ok(total > 1);
    assert.deepEqual(shards, Array.from({ length: total }, (_, index) => `${index + 1}/${total}`));
});

test('the stable verify check always waits for every group', () => {
    assert.match(jobs.verify, /^    if: always\(\)$/m);
    const needs = jobs.verify.match(/^    needs: \[([^\]]+)\]$/m);
    assert.ok(needs);
    assert.deepEqual(needs[1].split(', ').toSorted(), ['changes', ...groups.map(group => `verify-${group}`)].toSorted());
});
