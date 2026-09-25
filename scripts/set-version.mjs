// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { prepareVersion, writeVersion } from './for_release/version.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

try {
    const args = process.argv.slice(2);
    const check = args.includes('--check');
    const allowMajor = args.includes('--allow-major');
    const versions = args.filter(arg => !arg.startsWith('--'));
    if (args.some(arg => arg.startsWith('--') && !['--check', '--allow-major'].includes(arg)) ||
        versions.length > 1 || (!check && versions.length !== 1) || (check && allowMajor)) {
        throw new Error('Usage: yarn set-version <version> [--allow-major] | yarn set-version --check [version]');
    }
    const plan = prepareVersion(root, versions[0], { check, allowMajor });
    if (!check) {
        writeVersion(root, plan);
        execFileSync('yarn', ['install'], { cwd: root, stdio: 'inherit' });
    }
    console.log(`${check ? 'Checked' : 'Set'} version ${plan.version}: ${plan.packages} versioned packages, ${plan.unversioned} unversioned workspaces, ${plan.ranges} internal non-workspace ranges, ${plan.statements} documentation statements${check ? '' : `, ${plan.edits.length} files updated; yarn.lock refreshed`}.`);
} catch (error) {
    console.error(`Version ${process.argv.includes('--check') ? 'check' : 'update'} failed: ${error.message}`);
    process.exitCode = 1;
}
