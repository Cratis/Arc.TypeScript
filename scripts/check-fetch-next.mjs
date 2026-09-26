// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { mkdir, symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { available, tool, root, workspace, bundle, port, checkHost, writeFile, rm, join } from './fetch-host-check.mjs';

const version = available('next');
const directory = await workspace('next');
try {
    await bundle(directory);
    await writeFile(join(directory, 'package.json'), '{"private":true,"type":"module"}\n');
    await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
    await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
        target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', jsx: 'preserve',
        allowJs: true, skipLibCheck: true, noEmit: true
    }, include: ['**/*.ts', '**/*.tsx', '.next/types/**/*.ts'] }));
    await writeFile(join(directory, 'next.config.mjs'), `export default { outputFileTracingRoot: ${JSON.stringify(root)},
    experimental: { serverMinification: false }, eslint: { ignoreDuringBuilds: true } };\n`);
    await mkdir(join(directory, 'app'), { recursive: true });
    await writeFile(join(directory, 'app', 'layout.tsx'), 'export default function Layout({ children }: { children: React.ReactNode }) { return <html><body>{children}</body></html>; }\n');
    await writeFile(join(directory, 'app', 'page.tsx'), 'export default function Page() { return <div>Arc runtime check</div>; }\n');
    const arcRoute = join(directory, 'app', 'api', '[...arc]');
    const otherRoute = join(directory, 'app', '.cratis', '[...arc]');
    await mkdir(arcRoute, { recursive: true });
    await mkdir(otherRoute, { recursive: true });
    await writeFile(join(directory, 'arc-app.mjs'), `import { createScenarioApp } from './arc.mjs';
const singleton = globalThis.__arcFetchCheck ??= createScenarioApp();
export const app = await singleton;\n`);
    const route = importPath => `import { app } from '${importPath}';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => app.fetch(request);
export const POST = (request: Request) => app.fetch(request);\n`;
    await writeFile(join(arcRoute, 'route.ts'), route('../../../arc-app.mjs'));
    await writeFile(join(otherRoute, 'route.ts'), route('../../../arc-app.mjs'));
    const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1' };
    execFileSync(tool('next'), ['build', directory], { cwd: directory, env, stdio: 'inherit', timeout: 120_000 });
    const listen = await port();
    await checkHost(tool('next'), ['start', directory, '--hostname', '127.0.0.1', '--port', String(listen)],
        `http://127.0.0.1:${listen}`, { cwd: directory, env: { NEXT_TELEMETRY_DISABLED: '1' },
            scenario: { queryMethod: false }, label: `${version} App Router production (Node.js)` });
} finally { await rm(directory, { recursive: true, force: true }); }
