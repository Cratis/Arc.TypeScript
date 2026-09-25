#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Compile complete titled TypeScript/TSX product-page fences under repository NodeNext settings.

Every title ending in .ts or .tsx is compiled unless explicitly exempted below. Titles
ending in (excerpt), (illustrative), or (generated excerpt) are intentionally partial.
EXEMPT is a ratchet: removing an entry starts compiling that fence; missing, stale,
or unclassified titles fail the gate. Fixtures are real sample files or neighboring
page files. The small generatedMetadata fixture models the empty metadata shape in
Samples/Tasks/Features/generatedMetadata.ts; it does not mock framework APIs.
Compilation checks types, not whether an application starts.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'Documentation'
TSC = ROOT / 'node_modules/.bin/tsc'
FENCE = re.compile(r'^```(typescript|ts|tsx)(?=[ \t\r\n])([^\n]*)\n(.*?)^```\s*$', re.M | re.S)
TITLE = re.compile(r'\btitle="([^"]+)"')
PARTIAL = (' (excerpt)', ' (illustrative)', ' (generated excerpt)')
METADATA_FIXTURE = "import type { GeneratedMetadata } from '@cratis/arc.core';\nexport const metadata = { version: 1, artifacts: [] } satisfies GeneratedMetadata;\n"

# Paths are relative to Documentation. Every exception needs a concrete reason.
EXEMPT: dict[str, dict[str, str]] = {
    'coming-from-express-and-nestjs.md': {
        'Express 5': 'Named comparison tab, not a TypeScript file path.',
        'Arc for TypeScript': 'Named comparison tab, not a TypeScript file path.'
    },
    'chronicle/reactors/index.md': {'ShelfBuilder.ts': 'Uses AuthorRegistered and CreateShelf from other slices not defined on this page.'},
    'commands/command-validation.md': {'RenameTask.ts': 'Requires the application-owned TaskView read model not supplied on this page.'},
    'core/authorization.md': {
        'Features/Documents/ArchiveDocument.ts': 'Requires the application-owned Documents service not defined here.',
        'Features/Documents/for_ArchiveDocument/when_archiving/as_someone_else.ts': 'Depends on the Documents service and archive command.'
    },
    'core/index.md': {'server.ts': 'Two independent, alternative server.ts entry points share this title.'},
    'hosts/fetch-runtimes.md': {'server.ts': 'Alternative Bun and Deno server.ts files require different host runtimes.'},
    'hosts/websockets.md': {'server.ts': 'Alternative Express and Hono server.ts entry points share this title.'},
    'getting-started/continue-in-the-browser.md': {
        'tasks-web/vite.config.ts': 'Vite frontend config requires the separate frontend toolchain.',
        'tasks-web/src/TaskBoard.tsx': 'React UI imports generated frontend proxies, unavailable in this workspace.',
        'tasks-web/src/main.tsx': 'React UI requires a separate frontend project and JSX configuration.'
    },
    'identity/frontend.md': {
        'src/App.tsx': 'React UI imports generated identity proxies from a separate frontend project.',
        'src/Header.tsx': 'React identity UI requires the separate frontend runtime and JSX configuration.',
        'src/ArchiveButton.tsx': 'React identity UI requires the separate frontend runtime and JSX configuration.'
    },
    'proxy-generation/frontend-usage.md': {
        'Web/src/App.tsx': 'React app needs generated proxies and a separate frontend toolchain.',
        'Web/src/Features/Authors/Registration/RegisterAuthorForm.tsx': 'React form needs generated proxies and a separate frontend toolchain.'
    },
    'identity/provider-flow.md': {'Features/Identity/DirectoryDetails.ts': 'Depends on an application-owned Directory service not defined here.'},
}

# Page -> (source tree, destination tree, excluded relative paths). Only actual
# sample sources are copied; examples always override their matching sample file.
SAMPLE_FIXTURES: dict[str, tuple[str, str, tuple[str, ...]]] = {
    'hosts/index.md': ('Samples/Tasks/Features', 'Features', ()),
    'commands/index.md': ('Samples/Tasks/Features', 'Features', ('Tasks/Registration/Registration.ts', 'generatedMetadata.ts')),
    'queries/model-bound/index.md': ('Samples/Tasks/Features', 'Features', ('Tasks/Listing/Listing.ts',)),
    'getting-started/index.md': ('Samples/Tasks', 'Samples/Tasks', ('main.ts',)),
    'getting-started/your-first-command.md': ('Samples/Tasks/Features', 'Features', ()),
    'core/index.md': ('Samples/Tasks/Features', 'Features', ()),
    'testing/index.md': ('Samples/Tasks/Features', 'Features', ()),
    'testing/queries.md': ('Samples/Tasks/Features', 'Features', ()),
    'testing/chronicle.md': ('Samples/Library/Features', 'Features', ()),
    'testing/chronicle-kernel.md': ('Samples/Library/Features', 'Features', ()),
    'hosts/express.md': ('Samples/Tasks/Features', 'Features', ()),
    'hosts/fastify.md': ('Samples/Tasks/Features', 'Features', ()),
    'hosts/hono.md': ('Samples/Tasks/Features', 'Features', ()),
}

# Page -> {destination: (source page, title)}. An excerpt may be assembled
# below, but no framework definitions are invented here.
PAGE_FIXTURES: dict[str, dict[str, tuple[str, str]]] = {
    'hosts/express.md': {'arc.ts': ('hosts/index.md', 'arc.ts')},
    'hosts/fastify.md': {'arc.ts': ('hosts/index.md', 'arc.ts')},
    'hosts/hono.md': {'arc.ts': ('hosts/index.md', 'arc.ts')},
    'testing/chronicle-kernel.md': {
        'Features/Books/Lending/Lending.ts': ('testing/chronicle.md', 'Features/Books/Lending/Lending.ts'),
    },
    'chronicle/add-event-sourcing.md': {
        f'Features/Notes/{name}': ('getting-started/create-an-application.md', f'Features/Notes/{name}')
        for name in ('NoteId.ts', 'NoteText.ts', 'Writing/Writing.ts', 'Listing/Listing.ts', 'Notes.ts')
    },
}
GENERATED_METADATA_PAGES = {'chronicle/add-event-sourcing.md', 'getting-started/create-an-application.md', 'chronicle/cratis-package.md'}


class InvalidExample(Exception):
    pass


def fences(page: Path) -> tuple[list[tuple[str | None, str]], int]:
    """Return every TS fence (including untitled fences) and the total count."""
    entries = []
    for match in FENCE.finditer(page.read_text(encoding='utf-8')):
        title = TITLE.search(match.group(2))
        entries.append((title.group(1) if title else None, match.group(3)))
    return entries, len(entries)


def safe_path(name: str) -> bool:
    path = Path(name)
    return not path.is_absolute() and all(part not in ('.', '..') for part in path.parts) and path.suffix in ('.ts', '.tsx')


def sample_fixtures(destination: Path, source_root: str, prefix: str, excluded: set[str]) -> None:
    sample = ROOT / source_root
    for source in sorted(sample.rglob('*.ts')):
        path = source.relative_to(sample)
        # Build output and generated client proxies are not sample source; `yarn ci` writes them before this gate runs.
        if any(part.startswith('for_') or part in ('given', 'dist', 'node_modules') for part in path.parts):
            continue
        if path.as_posix() in excluded:
            continue
        target = destination / prefix / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)


def fixtures(page: str, destination: Path, selected: set[str]) -> None:
    if page in SAMPLE_FIXTURES:
        source, prefix, excluded = SAMPLE_FIXTURES[page]
        sample_fixtures(destination, source, prefix, set(excluded) | {
            str(Path(name).relative_to(prefix)) for name in selected if name.startswith(prefix + '/')
        })
    for target_name, (source_page, source_title) in PAGE_FIXTURES.get(page, {}).items():
        entries, _ = fences(DOCS / source_page)
        matches = [code for name, code in entries if name == source_title]
        if len(matches) != 1:
            raise InvalidExample(f'{page}: missing unique fixture {source_page}: {source_title}')
        target = destination / target_name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(matches[0], encoding='utf-8')
    if page in GENERATED_METADATA_PAGES:
        target = destination / 'Features/generatedMetadata.ts'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(METADATA_FIXTURE, encoding='utf-8')
    if page.startswith('testing/') or page in ('getting-started/your-first-command.md', 'core/authorization.md'):
        shutil.copyfile(ROOT / 'test.d.ts', destination / 'test.d.ts')
    if page == 'chronicle/aggregates/injecting-into-commands.md':
        other, _ = fences(DOCS / 'chronicle/aggregates/defining-an-aggregate-root.md')
        current, _ = fences(DOCS / page)
        base = next(code for name, code in other if name == 'Features/Orders/Adding/Adding.ts')
        excerpt = next(code for name, code in current if name == 'Features/Orders/Adding/Adding.ts (excerpt)')
        extra = excerpt.replace('import { AggregateRoot, commandAggregate }', 'import { commandAggregate }')
        target = destination / 'Features/Orders/Adding/Adding.ts'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(base + '\n' + extra, encoding='utf-8')


def verify_tasks_entry(entries: list[tuple[str | None, str]]) -> None:
    code = [source for title, source in entries if title == 'Samples/Tasks/main.ts']
    if len(code) != 1:
        raise InvalidExample('getting-started/index.md: expected exactly one Samples/Tasks/main.ts fence')
    sample = (ROOT / 'Samples/Tasks/main.ts').read_text(encoding='utf-8')
    header = '// Copyright (c) Cratis. All rights reserved.\n// Licensed under the MIT license. See LICENSE file in the project root for full license information.\n'
    if not sample.startswith(header) or code[0] != sample[len(header):]:
        raise InvalidExample('getting-started/index.md: Samples/Tasks/main.ts fence differs from sample (minus license header)')


def compile_pages(directory: Path, plant: bool = False) -> tuple[int, int, int, int, list[str]]:
    problems: list[str] = []
    compiled = exempt = excerpt = pages = 0
    seen_exempt: set[tuple[str, str]] = set()
    for path in sorted(DOCS.rglob('*.md')):
        if 'client-snippets' in path.parts:
            continue
        pages += 1
        page = path.relative_to(DOCS).as_posix()
        entries, _ = fences(path)
        try:
            if page == 'getting-started/index.md':
                verify_tasks_entry(entries)
            selected: dict[str, str] = {}
            for name, source in entries:
                if name is None:
                    continue
                if name.endswith(PARTIAL):
                    excerpt += 1
                    continue
                if name in EXEMPT.get(page, {}):
                    seen_exempt.add((page, name))
                    exempt += 1
                    continue
                if not safe_path(name) or name in selected:
                    raise InvalidExample(f'{page}: unclassified, unsafe, or duplicate titled TypeScript file {name}')
                selected[name] = source
            if not selected:
                continue
            project = directory / page.removesuffix('.md')
            project.mkdir(parents=True)
            fixtures(page, project, set(selected))
            for name, source in selected.items():
                target = project / name
                target.parent.mkdir(parents=True, exist_ok=True)
                if plant and page == 'commands/index.md':
                    source += '\nconst planted: number = "type error";\nconst strictPlant = (value) => value;\n'
                target.write_text(source, encoding='utf-8')
            (project / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
            (project / 'package.json').write_text('{"type":"module"}\n', encoding='utf-8')
            config = {
                'extends': str(ROOT / 'tsconfig.json'),
                'compilerOptions': {'composite': False, 'declaration': False, 'incremental': False,
                                    'noEmit': True, 'types': ['node', 'vitest/globals', 'chai', 'sinon']},
                'include': ['**/*.ts', '**/*.tsx', '**/*.d.ts'],
                'exclude': ['node_modules'],
            }
            (project / 'tsconfig.json').write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
            result = subprocess.run([str(TSC), '-p', str(project / 'tsconfig.json'), '--pretty', 'false'],
                                    capture_output=True, text=True, check=False)
            output = (result.stdout + result.stderr).strip()
            if result.returncode:
                problems.append(f'{page}:\n{output or f"tsc exited {result.returncode} without diagnostics"}')
            compiled += len(selected)
        except (InvalidExample, OSError, StopIteration) as error:
            problems.append(f'{page}: {error}')
    stale = {(page, title) for page, titles in EXEMPT.items() for title in titles} - seen_exempt
    for page, titles in EXEMPT.items():
        for title, reason in titles.items():
            if not reason.strip():
                problems.append(f'{page}: exemption {title} has no reason')
    for page, title in sorted(stale):
        problems.append(f'{page}: stale exemption {title}')
    return pages, compiled, exempt, excerpt, problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--self-test', action='store_true', help='plant TS2322 and strict-mode TS7006')
    args = parser.parse_args()
    if not TSC.is_file() or not (ROOT / 'Source/Core/dist/index.d.ts').is_file():
        print('BLOCKED: install dependencies and run yarn build first', file=sys.stderr)
        return 2
    with tempfile.TemporaryDirectory(prefix='arc-page-examples-') as temporary:
        pages, compiled, exempt, excerpt, problems = compile_pages(Path(temporary), args.self_test)
    if args.self_test:
        if len(problems) != 1 or not all(code in problems[0] for code in ('commands/index.md:', 'error TS2322:', 'error TS7006:')):
            print('FAIL: planted errors were not the only errors:\n' + '\n'.join(problems), file=sys.stderr)
            return 1
        print('Self-test passed: planted TS2322 and strict-mode TS7006 were caught; other examples compiled.')
        return 0
    if not pages or not compiled or problems:
        for problem in problems or ['no product pages or compiled examples']:
            print('FAIL ' + problem, file=sys.stderr)
        return 1
    print(f'Compiled {compiled} titled fences; exempt {exempt}; excerpt {excerpt}; scanned {pages} product pages.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
