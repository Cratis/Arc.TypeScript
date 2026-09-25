// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { spawn, execFileSync } from 'node:child_process';
import console from 'node:console';
import process from 'node:process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const workspace = join(root, '../..');
const compiler = join(workspace, 'node_modules/.bin/tsc');
execFileSync(compiler, ['-b', join(workspace, 'Source/Core'), join(workspace, 'Source/Express'),
    join(workspace, 'Source/Chronicle'), join(workspace, 'Source/Tools/ProxyGenerator')], { stdio: 'inherit' });
execFileSync('yarn', ['generate-proxies'], { cwd: root, stdio: 'inherit' });
mkdirSync(join(root, 'Web/src/generated'), { recursive: true });
const generator = join(workspace, 'Source/Tools/ProxyGenerator/dist/cli.js');
const children = [
    spawn(process.execPath, [generator, '--project', join(root, 'tsconfig.json'), '--artifacts', join(root, 'Features'),
        '--output', join(root, 'Web/src/generated'), '--metadata', join(root, 'Features/generatedMetadata.ts'),
        '--use-proxy-file-suffix', '--watch'], { cwd: root, stdio: 'inherit' }),
    spawn('yarn', ['exec', 'tsx', 'watch', 'main.ts'], { cwd: root, stdio: 'inherit' }),
    spawn('yarn', ['workspace', '@cratis/arc.sample.library.web', 'dev'], { cwd: workspace, stdio: 'inherit' })
];
let stopping = false;
function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill('SIGTERM');
    process.exitCode = code;
}
for (const child of children) {
    child.on('error', error => { console.error(error); stop(1); });
    child.on('exit', code => { if (!stopping) stop(code || 1); });
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
