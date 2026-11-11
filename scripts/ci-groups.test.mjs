// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
// Deliberately pin the pre-split gate: editing both ci and its groups must not silently remove coverage.
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
const groups = ['contracts', 'packages', 'specs', 'integration-docs'];
const guard = 'node --test scripts/ci-groups.test.mjs';
const commands = script => script.split(' && ');
// This intentionally accepts only the workflow's simple, explicit job/run layout (not arbitrary YAML).
const jobEntries = [...workflow.matchAll(/^  ([\w-]+):\n([\s\S]*?)(?=^  [\w-]+:\n|$(?![\s\S]))/gm)]
    .map(([, id, body]) => [id, body]);
const jobs = Object.fromEntries(jobEntries);

test('the complete local gate runs every original command exactly once, plus the coverage guard', () => {
    assert.deepEqual(commands(scripts.ci), groups.map(group => `yarn ci:${group}`));
    assert.deepEqual(Object.keys(scripts).filter(key => key.startsWith('ci:') && groups.includes(key.slice(3))).sort(),
        groups.map(group => `ci:${group}`).sort());
    const grouped = groups.flatMap(group => commands(scripts[`ci:${group}`]));
    assert.deepEqual(grouped.toSorted(), [...originalCommands, guard].toSorted());
    assert.equal(new Set(grouped).size, grouped.length);
    const contracts = commands(scripts['ci:contracts']);
    assert.deepEqual(contracts.slice(0, 7), originalCommands.slice(0, 7));
    assert.equal(scripts['ci:specs'], 'yarn test');
});

test('CI runs every local group with locked dependencies and its build prerequisites', () => {
    assert.equal(Object.keys(jobs).length, jobEntries.length, 'duplicate job ids');
    assert.deepEqual(Object.keys(jobs).filter(id => id.startsWith('verify-')).sort(),
        groups.map(group => `verify-${group}`).sort());
    for (const group of groups) {
        const job = jobs[`verify-${group}`];
        assert.match(job, /^    needs: changes$/m);
        assert.deepEqual([...job.matchAll(/^\s+if: (.+)$/gm)].map(([, condition]) => condition),
            ["needs.changes.outputs.code == 'true'"]);
        assert.doesNotMatch(job, /continue-on-error/);
        assert.match(job, /node-version: '22\.19\.0'/);
        const run = `yarn ci:${group}${group === 'specs' ? ' --shard=${{ matrix.shard }}' : ''}`;
        const prerequisites = group === 'contracts' ? [] : ['yarn build'];
        assert.deepEqual([...job.matchAll(/^        run: (.+)$/gm)].map(([, command]) => command),
            ['corepack enable', 'yarn install --immutable', ...prerequisites, run]);
    }
    assert.match(jobs['verify-specs'], /^      fail-fast: false$/m);
    assert.match(jobs['verify-specs'], /^        shard: \['1\/2', '2\/2'\]$/m);
});

test('the stable verify check always waits for all groups, including both spec shards', () => {
    assert.match(jobs.verify, /^    if: always\(\)$/m);
    const needs = jobs.verify.match(/^    needs: \[([^\]]+)\]$/m);
    assert.ok(needs);
    assert.deepEqual(needs[1].split(', '), ['changes', ...groups.map(group => `verify-${group}`)]);
    assert.match(jobs.verify, /NEEDS_JSON: \$\{\{ toJSON\(needs\) \}\}/);
});

function aggregateResult(code, results, changesResult = 'success') {
    const match = jobs.verify.match(/node --input-type=module <<'NODE'\n([\s\S]+?)          NODE/);
    assert.ok(match, 'aggregate must expose its actual Node check');
    const needs = {
        changes: { result: changesResult, outputs: { code } },
        ...Object.fromEntries(groups.map((group, index) => [`verify-${group}`, { result: results[index] }]))
    };
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', match[1]], {
        env: { ...process.env, NEEDS_JSON: JSON.stringify(needs) }, encoding: 'utf8'
    });
    assert.ifError(result.error);
    return result.status;
}

test('verify accepts successful groups and intentional non-code skips', () => {
    assert.equal(aggregateResult('true', groups.map(() => 'success')), 0);
    assert.equal(aggregateResult('false', groups.map(() => 'skipped')), 0);
});

test('verify rejects failures, cancellation, unexpected skips and a failed change classifier', () => {
    for (const result of ['failure', 'cancelled', 'skipped']) {
        for (const index of groups.keys()) {
            const results = groups.map(() => 'success');
            results[index] = result;
            assert.equal(aggregateResult('true', results), 1);
        }
    }
    assert.equal(aggregateResult('false', groups.map(() => 'success')), 1);
    assert.equal(aggregateResult('false', groups.map(() => 'skipped'), 'failure'), 1);
});
