// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { generateFromSource } from '@cratis/arc.proxygenerator';

export const root = resolve(import.meta.dirname, '../..');
export const fixture = join(root, 'ContractTests/ProxyComparison');
export const dotnetOptions = ['0', '--exclude-namespace=HttpFixture*'];
export const dotnetSource = 'ContractTests/DotNET/ProxyComparison/Fixtures.cs';
export const recaptureCommand = 'dotnet restore ContractTests/DotNET/HttpFixture.csproj --locked-mode && dotnet build ContractTests/DotNET/HttpFixture.csproj -c Debug --no-restore && node ContractTests/ProxyComparison/compare.mjs --capture';
export const typescriptOptions = { rootNamespace: 'ProxyComparison' };

export function run(command, args) {
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
    return result.stdout;
}

/** Uses the package restored by HttpFixture, not a global tool or the neighboring Arc checkout. */
export async function generateBoth(output) {
    const lock = JSON.parse(await readFile(join(root, 'ContractTests/DotNET/packages.lock.json'), 'utf8'));
    const dependency = lock.dependencies['net10.0']['Cratis.Arc.ProxyGenerator.Build'];
    assert.equal(dependency.resolved, '22.45.0');
    assert.equal(dependency.requested, '[22.45.0, 22.45.0]');
    const assets = JSON.parse(await readFile(join(root, 'ContractTests/DotNET/obj/project.assets.json'), 'utf8'));
    const library = assets.libraries['Cratis.Arc.ProxyGenerator.Build/22.45.0'];
    assert.ok(library, 'Run the locked .NET restore first');
    assert.equal(library.sha512, dependency.contentHash);
    let executable;
    for (const folder of Object.keys(assets.packageFolders)) {
        const candidate = join(folder, library.path, 'tasks/net10.0/Cratis.Arc.ProxyGenerator.Build.dll');
        try { await access(candidate); executable = candidate; break; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    assert.ok(executable, 'Pinned .NET generator was not restored');
    const dotnet = join(output, 'DotNET');
    const typescript = join(output, 'TypeScript');
    await mkdir(dotnet, { recursive: true });
    await mkdir(typescript, { recursive: true });
    const log = run('dotnet', [executable, join(root, 'ContractTests/DotNET/bin/Debug/net10.0/Arc.TypeScript.HttpFixture.dll'), dotnet, ...dotnetOptions]);
    await generateFromSource({ project: join(fixture, 'TypeScript/tsconfig.json'), artifacts: join(fixture, 'TypeScript'),
        output: typescript, ...typescriptOptions });
    return { dotnet, typescript, log };
}
