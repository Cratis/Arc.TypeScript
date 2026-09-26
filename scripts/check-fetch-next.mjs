// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { mkdir } from 'node:fs/promises';
import { available, tool, workspace, bundle, port, checkHost, writeFile, rm, join } from './fetch-host-check.mjs';

const version = available('next');
const directory = await workspace('next');
try {
    await bundle(directory);
    await writeFile(join(directory, 'package.json'), '{"private":true,"type":"module"}\n');
    await mkdir(join(directory, 'app'), { recursive: true });
    await writeFile(join(directory, 'app', 'layout.tsx'), 'export default function Layout({ children }: { children: React.ReactNode }) { return <html><body>{children}</body></html>; }\n');
    await writeFile(join(directory, 'app', 'page.tsx'), 'export default function Page() { return <div>Arc runtime check</div>; }\n');
    const arcRoute = join(directory, 'app', 'api', '[...arc]');
    const otherRoute = join(directory, 'app', '[...arc]');
    await mkdir(arcRoute, { recursive: true });
    await mkdir(otherRoute, { recursive: true });
    const route = (importPath, runtime) => `import { createScenarioApp } from '${importPath}';
export const runtime = '${runtime}';
export const dynamic = 'force-dynamic';
const app = await createScenarioApp();
export const GET = (request: Request) => app.fetch(request);
export const POST = (request: Request) => app.fetch(request);\n`;
    await writeFile(join(arcRoute, 'route.ts'), route('../../../arc.mjs', 'nodejs'));
    await writeFile(join(otherRoute, 'route.ts'), route('../../arc.mjs', 'nodejs'));
    const listen = await port();
    await checkHost(tool('next'), ['dev', directory, '--hostname', '127.0.0.1', '--port', String(listen)],
        `http://127.0.0.1:${listen}`, { cwd: directory, env: { NEXT_TELEMETRY_DISABLED: '1' },
            scenario: { queryMethod: false }, label: `${version} App Router (Node.js)` });
} finally { await rm(directory, { recursive: true, force: true }); }
