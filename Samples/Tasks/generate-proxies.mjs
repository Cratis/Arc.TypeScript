// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'dist/proxies');
mkdirSync(output, { recursive: true });
execFileSync(process.execPath, [resolve(root, '../../Source/Tools/ProxyGenerator/dist/cli.js'),
    '--project', join(root, 'tsconfig.json'), '--artifacts', join(root, 'Features'), '--output', output,
    '--metadata', join(root, 'Features/generatedMetadata.ts'), '--use-proxy-file-suffix'], { stdio: 'inherit' });
execFileSync(resolve(root, '../../node_modules/.bin/tsc'),
    ['-p', join(root, 'tsconfig.proxies.json')], { stdio: 'inherit' });
