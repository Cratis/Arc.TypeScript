// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from 'node:child_process';
import { planRelease } from './for_release/plan.mjs';

function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

try {
    const defaultBranch = process.env.DEFAULT_BRANCH;
    // Validate the branch before it is used in a Git argument.
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(defaultBranch ?? '') || defaultBranch.includes('..') || defaultBranch.includes('//') || defaultBranch.endsWith('/')) {
        throw new Error('Invalid default branch');
    }
    const sha = process.env.GITHUB_SHA;
    if (git('rev-parse', 'HEAD') !== sha) throw new Error('Checked-out commit does not match the dispatch commit');
    const plan = planRelease({
        intent: process.env.RELEASE_INTENT,
        releaseNotes: process.env.RELEASE_NOTES,
        expectedCurrentVersion: process.env.EXPECTED_CURRENT_VERSION || undefined,
        tags: git('tag', '--list').split('\n').filter(Boolean),
        ref: process.env.GITHUB_REF,
        sha,
        defaultBranch,
        headSha: git('rev-parse', `refs/remotes/origin/${defaultBranch}`),
        npmPublishing: process.env.NPM_PUBLISHING
    });
    // Keep user-supplied notes on one JSON-escaped log line, never as workflow commands.
    console.log(JSON.stringify(plan));
} catch (error) {
    // Git tags and version inputs can contain newlines; do not write them raw to Actions logs.
    console.error(`Release preview refused: ${JSON.stringify(error.message)}`);
    process.exitCode = 1;
}
