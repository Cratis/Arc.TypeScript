// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const statements = new Map([
    ['README.md', /Every package manifest is at version (\d+\.\d+\.\d+)\. That is/g],
    ['Documentation/index.md', /the manifests are at version (\d+\.\d+\.\d+) for a source preview/g],
    ['Documentation/reference/packages.md', /Every package in this repository is at version (\d+\.\d+\.\d+), the version/g]
]);

export function validateVersion(version) {
    const match = stableVersion.exec(version ?? '');
    if (!match || match.slice(1).some(part => !Number.isSafeInteger(Number(part)))) {
        throw new Error(`Invalid stable version: ${version}`);
    }
    return match.slice(1).map(Number);
}

function workspacePaths(root) {
    const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    if (!Array.isArray(rootPackage.workspaces) || !rootPackage.workspaces.length) throw new Error('No workspaces configured');
    const paths = new Set();
    for (const pattern of rootPackage.workspaces) {
        if (typeof pattern !== 'string' || !/^[\w/-]+(?:\/\*)?$/.test(pattern)) throw new Error(`Unsupported workspace pattern: ${pattern}`);
        const wildcard = pattern.endsWith('/*');
        const folder = wildcard ? pattern.slice(0, -2) : pattern;
        const candidates = wildcard ? readdirSync(join(root, folder), { withFileTypes: true })
            .filter(entry => entry.isDirectory()).map(entry => `${folder}/${entry.name}`) : [folder];
        let found = 0;
        for (const candidate of candidates) {
            const path = join(root, candidate, 'package.json');
            try {
                readFileSync(path);
            } catch (error) {
                if (error.code === 'ENOENT' && wildcard) continue;
                throw error;
            }
            paths.add(candidate);
            found++;
        }
        if (!found) throw new Error(`No workspace manifests for ${pattern}`);
    }
    return [...paths].sort();
}

function readStatement(root, file, pattern) {
    const content = readFileSync(join(root, file), 'utf8');
    const matches = [...content.matchAll(pattern)];
    if (matches.length !== 1) throw new Error(`Expected exactly one version statement in ${file}, found ${matches.length}`);
    return { content, match: matches[0] };
}

/** Verify or prepare all version edits before writing any files. Workspace protocol ranges are intentionally untouched. */
export function prepareVersion(root, requestedVersion, { check = false, allowMajor = false } = {}) {
    if (requestedVersion !== undefined) validateVersion(requestedVersion);
    const manifests = workspacePaths(root).map(relativePath => {
        const file = `${relativePath}/package.json`;
        const original = readFileSync(join(root, file), 'utf8');
        return { file, original, package: JSON.parse(original) };
    });
    for (const manifest of manifests) {
        if ((manifest.file.startsWith('Source/') || manifest.file === 'ContractTests/Client/package.json') && manifest.package.version === undefined) {
            throw new Error(`Missing version in ${manifest.file}`);
        }
    }
    const versioned = manifests.filter(manifest => manifest.package.version !== undefined);
    if (!versioned.length) throw new Error('No versioned workspace packages found');
    for (const manifest of versioned) validateVersion(manifest.package.version);
    const version = requestedVersion ?? versioned[0].package.version;
    const newMajor = validateVersion(version)[0];
    if (!check && !allowMajor && versioned.some(manifest => validateVersion(manifest.package.version)[0] !== newMajor)) {
        throw new Error(`Major version change to ${version} requires --allow-major and human approval`);
    }
    const internalNames = new Set(manifests.map(manifest => manifest.package.name)
        .filter(name => typeof name === 'string' && (name.startsWith('@cratis/arc.') || name === '@cratis/cratis')));
    let ranges = 0;
    const problems = [];
    for (const manifest of manifests) {
        if (manifest.package.version !== undefined && check && manifest.package.version !== version) {
            problems.push(`${manifest.file}: version ${manifest.package.version}, expected ${version}`);
        }
        if (!check && manifest.package.version !== undefined) manifest.package.version = version;
        for (const section of dependencySections) {
            for (const [name, range] of Object.entries(manifest.package[section] ?? {})) {
                if (!internalNames.has(name) || (typeof range === 'string' && range.startsWith('workspace:'))) continue;
                ranges++;
                if (check && range !== `^${version}`) problems.push(`${manifest.file}: ${section}.${name} is ${range}, expected ^${version}`);
                if (!check) manifest.package[section][name] = `^${version}`;
            }
        }
    }
    if (!ranges) throw new Error('No non-workspace internal dependency ranges found');
    const edits = [];
    for (const manifest of manifests) {
        const updated = JSON.stringify(manifest.package, null, 2) + '\n';
        if (!check && updated !== manifest.original) edits.push({ file: manifest.file, content: updated });
    }
    for (const [file, pattern] of statements) {
        const { content, match } = readStatement(root, file, pattern);
        if (check && match[1] !== version) problems.push(`${file}: statement has ${match[1]}, expected ${version}`);
        if (!check) {
            const updated = content.slice(0, match.index) + match[0].replace(match[1], version) + content.slice(match.index + match[0].length);
            if (updated !== content) edits.push({ file, content: updated });
        }
    }
    if (problems.length) throw new Error(`Version consistency failed:\n${problems.join('\n')}`);
    return { version, packages: versioned.length, unversioned: manifests.length - versioned.length, ranges, statements: statements.size, edits };
}

export function writeVersion(root, plan) {
    for (const { file, content } of plan.edits) writeFileSync(join(root, file), content);
}
