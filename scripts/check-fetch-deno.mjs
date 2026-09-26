// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const entry = fileURLToPath(new URL('./fetch-runtime-scenario.mjs', import.meta.url));
const { outputFiles } = await build({ entryPoints: [entry], bundle: true, platform: 'neutral',
    format: 'esm', write: false, external: ['node:async_hooks'] });
const executable = process.env.DENO_BIN ?? 'deno';
const result = spawnSync(executable, ['run', '--quiet', '-'], { input: `${outputFiles[0].text}\nawait runScenario();\n`,
    encoding: 'utf8', stdio: ['pipe', 'inherit', 'inherit'] });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 2);
console.log('Deno Fetch: shared Fetch scenario passed');
