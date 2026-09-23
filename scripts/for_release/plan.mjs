// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const allowedSections = new Set(['Added', 'Changed', 'Fixed', 'Removed', 'Security', 'Deprecated']);
const templateBullets = [
    'Describe a new user-facing capability',
    'Describe a user-facing behavior change',
    'Describe a user-facing fix',
    'Describe what was removed for users',
    'Describe a user-facing security fix',
    'Describe the deprecated public API',
    'Describe a specific public capability that shipped',
    'Describe a specific user-visible bug that was fixed'
];

function versionParts(version) {
    const match = versionPattern.exec(version);
    if (!match) throw new Error(`Invalid stable version: ${version}`);
    const parts = match.slice(1).map(Number);
    if (parts.some(part => !Number.isSafeInteger(part))) throw new Error(`Version component is too large: ${version}`);
    return parts;
}

function compareVersions(left, right) {
    const a = versionParts(left);
    const b = versionParts(right);
    for (let index = 0; index < 3; index++) {
        if (a[index] !== b[index]) return a[index] - b[index];
    }
    return 0;
}

function checkedNotes(value) {
    if (typeof value !== 'string') throw new Error('Release notes must be Markdown');
    const notes = value.replace(/\r\n/g, '\n').trim();
    if (!notes || notes.length > 16000 || /[\r\x00-\x08\x0b-\x1f\x7f]/.test(notes)) {
        throw new Error('Release notes must be nonempty Markdown without control characters (at most 16000 characters)');
    }
    // The CLI writes JSON, not raw notes. Refuse copied template instructions and line-start
    // workflow commands; ordinary TypeScript code spans, generic types, and Markdown links are text.
    if (/<!--/i.test(notes) || /^\s*::[a-z][\w-]*(?: [^\n]*)?::/im.test(notes)) {
        throw new Error('Release notes contain an HTML comment or workflow command');
    }
    const sections = notes.split(/\n(?=## )/);
    const seen = new Set();
    for (const section of sections) {
        const [heading, ...lines] = section.split('\n');
        const name = heading.slice(3);
        if (!heading.startsWith('## ') || !allowedSections.has(name) || seen.has(name)) {
            throw new Error('Release notes must have unique Added, Changed, Fixed, Removed, Security, or Deprecated sections');
        }
        seen.add(name);
        if (!lines.some(line => /^- \S/.test(line))) throw new Error(`${name} needs a user-facing bullet`);
        if (lines.some(line => /^#/.test(line) || /^\s*-\s*$/.test(line))) throw new Error('Empty bullets and nested headings are not allowed');
    }
    if (/\b(?:TODO|TBD|placeholder|short statement of what|no release notes)\b/i.test(notes) ||
        notes.split('\n').some(line => templateBullets.some(bullet => line.trim().toLowerCase().replace(/[.!]$/, '') === `- ${bullet.toLowerCase()}`))) {
        throw new Error('Replace placeholder release notes with user-facing changes');
    }
    return notes;
}

/** Compute a preview only; this module has no release, tag, manifest, or registry effects. */
export function planRelease({ intent, releaseNotes, tags, expectedCurrentVersion, ref, sha, defaultBranch, headSha, npmPublishing }) {
    if (intent !== 'minor' && intent !== 'patch') throw new Error('Only minor or patch releases can be planned; major and no-release are not valid');
    if (npmPublishing !== 'off') throw new Error('npm publishing is not configured and must remain off');
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(defaultBranch) || defaultBranch.includes('..') || defaultBranch.includes('//') || defaultBranch.endsWith('/')) {
        throw new Error('Invalid default branch');
    }
    if (ref !== `refs/heads/${defaultBranch}`) throw new Error('Dispatch must target the default branch');
    if (!/^[0-9a-f]{40}$/.test(sha) || !/^[0-9a-f]{40}$/.test(headSha) || sha !== headSha) {
        throw new Error('Dispatch commit must still be the current default-branch commit');
    }
    if (!Array.isArray(tags)) throw new Error('Tags must be an array');
    const versions = tags.map(tag => {
        if (typeof tag !== 'string' || !tag.startsWith('v')) throw new Error(`Unexpected release tag: ${tag}`);
        const version = tag.slice(1);
        versionParts(version);
        return version;
    });
    const currentVersion = versions.sort(compareVersions).at(-1) ?? '0.0.0';
    if (expectedCurrentVersion !== undefined) {
        versionParts(expectedCurrentVersion);
        if (currentVersion !== expectedCurrentVersion) throw new Error(`Expected ${expectedCurrentVersion}, found ${currentVersion}`);
    }
    const [major, minor, patch] = versionParts(currentVersion);
    const nextVersion = intent === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
    versionParts(nextVersion);
    const tag = `v${nextVersion}`;
    if (tags.includes(tag)) throw new Error(`Tag already exists: ${tag}`);
    const notes = checkedNotes(releaseNotes);
    return {
        intent, currentVersion, nextVersion, tag, notes,
        commit: sha, npmPublishing: 'off', effects: 'none',
        versionBookkeeping: 'unverified: package inventory and manifest versions are not configured'
    };
}
