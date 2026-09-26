// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { available, tool, workspace, bundle, port, checkHost, writeFile, rm, join } from './fetch-host-check.mjs';

const version = available('bun');
const directory = await workspace('bun');
try {
    await bundle(directory);
    const entry = join(directory, 'server.mjs');
    await writeFile(entry, `import { createScenarioApp } from './arc.mjs';
const app = await createScenarioApp();
const server = Bun.serve({ hostname: '127.0.0.1', port: Number(process.env.PORT), fetch: request => app.fetch(request) });
process.on('SIGTERM', async () => { server.stop(true); await app.dispose(); process.exit(0); });\n`);
    const listen = await port();
    await checkHost(tool('bun'), [entry], `http://127.0.0.1:${listen}`, { env: { PORT: String(listen) }, label: `Bun ${version} Bun.serve` });
} finally { await rm(directory, { recursive: true, force: true }); }
