#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Compile opted-in product-page TypeScript fences as one module tree per page.

A titled fence is a complete file only when its page and title appear in PAGES below.
Expressive Code already understands title="path/to/file.ts"; no custom rendering metadata
is needed. Untitled fences and titles ending in "(excerpt)" remain illustrations.
Add the title to PAGES when opting in a new complete file. A page may supply only
fixture files from real samples or explicitly named neighboring pages, never mock
framework APIs. The compiler checks types, not whether an application can start.
"""

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
FENCE = re.compile(r'^```(typescript|tsx)([^\n]*)\n(.*?)^```\s*$', re.M | re.S)
TITLE = re.compile(r'\btitle="([^"]+)"')

# Paths are relative to Documentation. A title is both the rendered tab name and
# the exact file path inside the per-page compilation project.
PAGES = {
    'getting-started/create-an-application.md': (
        'Features/Notes/NoteId.ts', 'Features/Notes/NoteText.ts',
        'Features/Notes/Writing/Writing.ts', 'Features/Notes/Listing/Listing.ts',
        'Features/Notes/Notes.ts', 'main.ts'),
    'chronicle/add-event-sourcing.md': (
        'main.ts', 'Features/Authors/AuthorId.ts', 'Features/Authors/AuthorName.ts',
        'Features/Authors/Registration/Registration.ts', 'Features/Authors/Listing/Listing.ts'),
    'core/getting-started.md': ('Status.ts', 'main.ts'),
    'hosts/index.md': ('arc.ts',),
    'sql/getting-started.md': ('Tasks.ts', 'TaskQueries.ts', 'main.ts', 'AddTask.ts', 'RenameTask.ts'),
    'chronicle/aggregates/defining-an-aggregate-root.md': ('Features/Orders/Adding/Adding.ts',),
    'chronicle/aggregates/injecting-into-commands.md': ('main.ts',),
    'testing/chronicle.md': (
        'Features/Books/Lending/Lending.ts',
        'Features/Books/Lending/for_LendBook/when_lending/with_a_book_in_the_catalog.ts'),
    'commands/index.md': ('Features/Tasks/Registration/Registration.ts',),
    'queries/model-bound/index.md': ('Features/Tasks/Listing/Listing.ts',),
    'queries/model-bound/paging.md': ('Product.ts',),
    'queries/model-bound/query-arguments.md': ('Item.ts',),
}

TASKS = ROOT / 'Samples/Tasks/Features'
LIBRARY = ROOT / 'Samples/Library/Features'
METADATA_FIXTURE = "import type { GeneratedMetadata } from '@cratis/arc.core';\nexport const metadata = { version: 1, artifacts: [] } satisfies GeneratedMetadata;\n"


class InvalidExample(Exception):
    pass


def fences(page: Path, selected: set[str] | None = None) -> tuple[dict[str, str], int]:
    """Extract titled TypeScript fences and count all TS/TSX fences."""
    files: dict[str, str] = {}
    count = 0
    for match in FENCE.finditer(page.read_text(encoding='utf-8')):
        count += 1
        title = TITLE.search(match.group(2))
        if title:
            name = title.group(1)
            if name in files and selected is not None and name in selected:
                raise InvalidExample(f'{page.relative_to(ROOT)}: duplicate opted-in TypeScript title {name}')
            files[name] = match.group(3).rstrip() + '\n'
    return files, count


def safe_path(name: str) -> bool:
    path = Path(name)
    return not path.is_absolute() and all(part not in ('.', '..') for part in path.parts) and path.suffix in ('.ts', '.tsx')


def sample_fixtures(destination: Path, sample: Path, excluded: set[str]) -> None:
    """Use actual sample files, never retyped stand-ins for sample-owned types."""
    for source in sorted(sample.rglob('*.ts')):
        path = source.relative_to(sample)
        if any(part.startswith('for_') or part == 'given' for part in path.parts):
            continue
        if path.as_posix() in excluded:
            continue
        target = destination / 'Features' / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)


def fixtures(page: str, destination: Path) -> None:
    if page in ('hosts/index.md', 'commands/index.md', 'queries/model-bound/index.md'):
        excluded = {
            'commands/index.md': {'Tasks/Registration/Registration.ts', 'generatedMetadata.ts'},
            'queries/model-bound/index.md': {'Tasks/Listing/Listing.ts'},
        }.get(page, set())
        sample_fixtures(destination, TASKS, excluded)
    elif page == 'chronicle/add-event-sourcing.md':
        notes, _ = fences(DOCS / 'getting-started/create-an-application.md')
        for name in PAGES['getting-started/create-an-application.md']:
            if name != 'main.ts':
                target = destination / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(notes[name], encoding='utf-8')
        target = destination / 'Features/generatedMetadata.ts'
        target.write_text(METADATA_FIXTURE, encoding='utf-8')
    elif page == 'getting-started/create-an-application.md':
        target = destination / 'Features/generatedMetadata.ts'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(METADATA_FIXTURE, encoding='utf-8')
    elif page == 'testing/chronicle.md':
        sample_fixtures(destination, LIBRARY, set())
        shutil.copyfile(ROOT / 'test.d.ts', destination / 'test.d.ts')
    elif page == 'chronicle/aggregates/injecting-into-commands.md':
        other, _ = fences(DOCS / 'chronicle/aggregates/defining-an-aggregate-root.md')
        excerpt, _ = fences(DOCS / page)
        # The excerpt continues the file on the preceding page. Keep both
        # authored sources intact; only remove its repeated AggregateRoot import.
        extra = excerpt['Features/Orders/Adding/Adding.ts (excerpt)'].replace(
            'import { AggregateRoot, commandAggregate }', 'import { commandAggregate }')
        target = destination / 'Features/Orders/Adding/Adding.ts'
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(other['Features/Orders/Adding/Adding.ts'] + '\n' + extra, encoding='utf-8')


def compile_pages(pages: dict[str, tuple[str, ...]], directory: Path, plant: bool = False) -> tuple[int, int, list[str]]:
    """Return pages compiled, fences compiled, and diagnostics/contract failures."""
    problems: list[str] = []
    compiled = 0
    for page, titles in sorted(pages.items()):
        path = DOCS / page
        if not path.is_file():
            problems.append(f'{page}: page missing')
            continue
        try:
            candidates, _ = fences(path, set(titles))
            if len(titles) != len(set(titles)) or not titles:
                raise InvalidExample(f'{page}: empty or duplicate opted-in titles')
            missing = set(titles) - candidates.keys()
            if missing:
                raise InvalidExample(f'{page}: missing titled TypeScript fence(s): {", ".join(sorted(missing))}')
            if any(not safe_path(name) for name in titles):
                raise InvalidExample(f'{page}: titles must be relative .ts/.tsx paths without ..')
            selected = {name: candidates[name] for name in titles}
            project = directory / page.removesuffix('.md')
            project.mkdir(parents=True)
            fixtures(page, project)
            for name, source in selected.items():
                target = project / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(source + ('\nconst planted: number = "type error";\n' if plant and page == 'commands/index.md' else ''), encoding='utf-8')
            (project / 'node_modules').symlink_to(ROOT / 'node_modules', target_is_directory=True)
            config = {
                'extends': str(ROOT / 'tsconfig.json'),
                'compilerOptions': {'module': 'ESNext', 'moduleResolution': 'Bundler',
                                    'composite': False, 'declaration': False, 'incremental': False,
                                    'noEmit': True, 'types': ['node', 'vitest/globals', 'chai', 'sinon']},
                'include': ['**/*.ts', '**/*.tsx', '**/*.d.ts'],
                'exclude': ['node_modules'],
            }
            (project / 'tsconfig.json').write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
            result = subprocess.run([str(TSC), '-p', str(project / 'tsconfig.json'), '--pretty', 'false'],
                                    capture_output=True, text=True, check=False)
            output = (result.stdout + result.stderr).strip()
            if result.returncode:
                if not output:
                    raise InvalidExample(f'{page}: tsc exited {result.returncode} without diagnostics')
                # Never discard non-TS diagnostics, which may indicate a broken gate.
                problems.append(f'{page}:\n{output}')
            compiled += len(selected)
        except (InvalidExample, OSError) as error:
            problems.append(str(error))
    return len(pages), compiled, problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--self-test', action='store_true', help='plant TS2322 and require the gate to reject it')
    args = parser.parse_args()
    if not TSC.is_file() or not (ROOT / 'Source/Core/dist/index.d.ts').is_file():
        print('BLOCKED: install dependencies and run yarn build first', file=sys.stderr)
        return 2
    pages_found = 0
    fences_found = 0
    for page in DOCS.rglob('*.md'):
        if 'client-snippets' in page.parts:
            continue
        pages_found += 1
        _, count = fences(page)
        fences_found += count
    if not pages_found or not fences_found or not PAGES:
        print('FAIL: no product pages, TypeScript fences, or opted-in examples', file=sys.stderr)
        return 1
    with tempfile.TemporaryDirectory(prefix='arc-page-examples-') as temporary:
        count, compiled, problems = compile_pages(PAGES, Path(temporary), args.self_test)
    if args.self_test:
        planted = [problem for problem in problems if 'commands/index.md:' in problem and 'error TS2322:' in problem]
        if len(planted) != 1 or len(problems) != 1:
            print('FAIL: planted error was not the only error:\n' + '\n'.join(problems), file=sys.stderr)
            return 1
        print('Self-test passed: planted TS2322 was caught; other examples compiled.')
        return 0
    if problems:
        for problem in problems:
            print('FAIL ' + problem, file=sys.stderr)
        return 1
    print(f'Compiled {compiled}/{fences_found} TypeScript fences on {count}/{pages_found} product pages.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
