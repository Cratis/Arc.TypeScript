#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.
"""Assemble the MongoDB tutorial from the published TypeScript tab sources in an empty directory."""
import argparse
from pathlib import Path
import re
import textwrap

root = Path(__file__).resolve().parents[2]
p = argparse.ArgumentParser()
p.add_argument('destination', type=Path, nargs='?')
p.add_argument('--arc-documentation', type=Path)
p.add_argument('--self-test', action='store_true')
a = p.parse_args()


def snippet(name):
    source = (root / 'Documentation/client-snippets' / (name + '.md')).read_text()
    result = re.fullmatch(r'```typescript\n(.*?)\n```\s*', source, re.S)
    if not result:
        raise ValueError(f'Not one TypeScript fence: {name}')
    return result[1]


def klass(text, name):
    match = re.search(r'(?m)^(?:export )?(?:abstract )?class ' + name + r'\b', text)
    if not match:
        raise ValueError(f'Missing class {name} in snippet')
    start = match.start()
    # Only decorators immediately above this class belong to it; never borrow
    # decorators from an earlier class or across a blank line.
    lines = text[:start].splitlines(keepends=True)
    while lines and lines[-1].strip().startswith('@'):
        start -= len(lines.pop())
    if any(line.lstrip().startswith('@') for line in ''.join(lines).rsplit('}', 1)[-1].splitlines()):
        raise ValueError(f'Detached decorator before {name}')
    brace = text.index('{', match.end())
    depth = 1
    i = brace + 1
    while depth:
        depth += (text[i] == '{') - (text[i] == '}')
        i += 1
    return text[start:i]


def require_replace(body, old, new):
    if body.count(old) != 1:
        raise ValueError(f'Expected exactly one occurrence of {old!r}')
    return body.replace(old, new, 1)


def function(text, name):
    match = re.search(r'\bexport async function ' + name + r'\(', text)
    if not match:
        raise ValueError(f'Missing function {name}')
    brace = text.index('{', match.end())
    depth = 1
    i = brace + 1
    while depth:
        depth += (text[i] == '{') - (text[i] == '}')
        i += 1
    return text[match.start():i]


def host_from_snippets(host, registration, index, header):
    # These checks make a missing chapter or an inverted development gate fail
    # before emitting a host, rather than silently running a private replacement.
    if not re.search(r'authentication:\s*development\s*\?\s*\[microsoftIdentityPlatform\(\)\]\s*:\s*\[\]', header):
        raise ValueError('Development authentication must be enabled only in development')
    if registration.count('builder.services.addScoped(BookRepository,') != 1:
        raise ValueError('Missing BookRepository registration')
    if 'readModels: [Author, Book]' not in registration or 'mongoCollection(Book)' not in registration:
        raise ValueError('Missing Book read model or collection')
    setup = header[header.index('const development ='):].strip().replace('\n', '\n    ')
    old_builder = "const builder = ArcApplication.createBuilder({ tenancy: { resolve: () => 'default' } });"
    host = require_replace(host, old_builder, setup)
    old_mongo = host[host.index('    builder.withMongoDB({'):host.index('    builder.services.addScoped(AuthorRepository,')]
    new_mongo = registration[registration.index('builder.withMongoDB({'):registration.index('builder.services.addScoped(BookRepository,')].strip()
    # The scratch run uses a unique database; all other setup is from the tab.
    new_mongo = require_replace(new_mongo, "database: 'Library'", "database: process.env.TUTORIAL_DATABASE ?? 'Library'")
    host = require_replace(host, old_mongo, '    ' + new_mongo.replace('\n', '\n    ') + '\n')
    book_service = registration[registration.index('builder.services.addScoped(BookRepository,'):].strip()
    old_author_service = host[host.index('    builder.services.addScoped(AuthorRepository,'):host.index('    // Use the same Features root')]
    host = require_replace(host, old_author_service, old_author_service + '    ' + book_service.replace('\n', '\n    ') + '\n')
    index_helper = function(index, 'ensureAuthorNameIndex')
    run_helper = function(index, 'startWithAuthorIndex')
    run_helper = require_replace(run_helper, 'await app.run({ port: 3000 });',
                                 'await app.run({ port: Number(process.env.PORT ?? 3000) });')
    host = require_replace(host, '    const app = await builder.build();\n    await app.run({ port: 3000 });',
                           '    await startWithAuthorIndex(builder);')
    host = require_replace(host, 'export async function start()',
                           index_helper + '\n\n' + run_helper + '\n\nexport async function start()')
    # The snippet's backend file imports its local feature types as instructed
    # in its comments; keep those imports explicit in this assembled file.
    preamble = imports("import { ArcApplication, microsoftIdentityPlatform, Severity, type ArcApplicationBuilder } from '@cratis/arc.core';",
        "import { mongoCollection, type MongoCollection } from '@cratis/arc.mongodb';",
        "import type { Filter, Document } from 'mongodb';",
        "import { metadata } from './Features/generatedMetadata.js';",
        "import { Author } from './Features/Authors/Author.js';",
        "import { AuthorRepository } from './Features/Authors/AuthorRepository.js';",
        "import { MongoAuthorRepository } from './Features/Authors/MongoAuthorRepository.js';",
        "import { Book } from './Features/Books/Book.js';",
        "import { BookRepository } from './Features/Books/BookRepository.js';",
        "import { MongoBookRepository } from './Features/Books/MongoBookRepository.js';")
    return preamble + host[host.index(index_helper):]


def self_test():
    assert klass('@first()\n@second()\nexport class Target {}', 'Target').startswith('@first()\n@second()')
    assert klass('@old()\nclass Earlier {}\n\nclass Target {}', 'Target') == 'class Target {}'
    try:
        klass('@skipped()\n\nclass Target {}', 'Target')
    except ValueError:
        pass
    else:
        raise AssertionError('Detached decorator was accepted')
    host = snippet('arc-without-event-sourcing/standalone-host')
    registration = snippet('tutorial/books-and-relationships/mongodb-book-registration')
    index = snippet('tutorial/validation/mongodb-unique-index')
    header = snippet('tutorial/authorization/development-header-adapter')
    assembled = host_from_snippets(host, registration, index, header)
    assert 'await startWithAuthorIndex(builder)' in assembled
    inverted = header.replace('development ? [microsoftIdentityPlatform()] : []',
                              'development ? [] : [microsoftIdentityPlatform()]')
    missing = registration.replace('builder.services.addScoped(BookRepository,',
                                   'builder.services.addScoped(OtherRepository,')
    assert inverted != header and missing != registration
    for changed_registration, changed_header in ((registration, inverted), (missing, header)):
        try:
            host_from_snippets(host, changed_registration, index, changed_header)
        except ValueError:
            continue
        raise AssertionError('A broken published host snippet was accepted')
    print('PASS assembler negative host and decorator tests')


def put(name, body):
    target = out / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body.strip() + '\n')


def imports(*items):
    return '\n'.join(items) + '\n\n'


if a.self_test:
    self_test()
    raise SystemExit(0)
if a.destination is None or a.arc_documentation is None:
    p.error('destination and --arc-documentation are required unless --self-test is set')
out = a.destination
out.mkdir(parents=True, exist_ok=True)

fund = "import { ConceptAs, Guid } from '@cratis/fundamentals';"
field = "import { field } from '@cratis/fundamentals';"
repo = 'arc-without-event-sourcing/'
auth = 'tutorial/first-slice/'
book = 'tutorial/books-and-relationships/'
values = snippet(book + 'book-concepts')
for name in ('BookId', 'BookTitle'):
    put(f'Features/Books/{name}.ts', imports(fund) + klass(values, name))
author_values = snippet(auth + 'author-concepts')
for name in ('AuthorId', 'AuthorName'):
    put(f'Features/Authors/{name}.ts', imports(fund) + klass(author_values, name))
host_tab = snippet(repo + 'standalone-host')
put('Features/Authors/AuthorRepository.ts', imports("import type { ObservableSource } from '@cratis/arc.core';",
    "import type { Author } from './Author.js';", "import type { AuthorId } from './AuthorId.js';",
    "import type { AuthorName } from './AuthorName.js';") + klass(host_tab, 'AuthorRepository'))
put('Features/Authors/MongoAuthorRepository.ts', imports("import type { ObservableSource } from '@cratis/arc.core';",
    "import type { MongoCollection } from '@cratis/arc.mongodb';", "import type { Filter, Document } from 'mongodb';",
    "import { Author } from './Author.js';", "import { AuthorId } from './AuthorId.js';",
    "import { AuthorName } from './AuthorName.js';", "import { AuthorRepository } from './AuthorRepository.js';") +
    klass(host_tab, 'MongoAuthorRepository').replace('class MongoAuthorRepository', 'export class MongoAuthorRepository'))
author_tab = snippet(auth + 'author-slice')
put('Features/Authors/RegisterAuthor.ts', imports(field, "import { command, inject } from '@cratis/arc.core';",
    "import { AuthorId } from './AuthorId.js';", "import { AuthorName } from './AuthorName.js';",
    "import { AuthorRepository } from './AuthorRepository.js';") + klass(author_tab, 'RegisterAuthor'))
put('Features/Authors/Author.ts', imports(field, "import { query, readModel, service, type ObservableSource } from '@cratis/arc.core';",
    "import { AuthorId } from './AuthorId.js';", "import { AuthorName } from './AuthorName.js';",
    "import { AuthorRepository } from './AuthorRepository.js';") + klass(author_tab, 'Author'))
rename_tab = snippet(repo + 'rename-author')
put('Features/Authors/RenameAuthor.ts', imports(field, "import { command, commandReadModel, inject, key } from '@cratis/arc.core';",
    "import { Author } from './Author.js';", "import { AuthorId } from './AuthorId.js';",
    "import { AuthorName } from './AuthorName.js';", "import { AuthorRepository } from './AuthorRepository.js';") +
    klass(rename_tab, 'RenameAuthor'))
put('Features/Authors/AuthorNameValidator.ts', imports("import { ConceptValidator, validator } from '@cratis/arc.core';",
    "import { AuthorName } from './AuthorName.js';") + klass(snippet('tutorial/validation/author-name-rule'), 'AuthorNameValidator'))
put('Features/Authors/RegisterAuthorValidator.ts', imports("import { CommandValidator, currentServices, validator } from '@cratis/arc.core';",
    "import { RegisterAuthor } from './RegisterAuthor.js';", "import { AuthorRepository } from './AuthorRepository.js';") +
    klass(snippet('tutorial/validation/duplicate-name-rule'), 'RegisterAuthorValidator'))
put('Features/Books/BookRepository.ts', imports("import type { ObservableSource } from '@cratis/arc.core';",
    "import type { AuthorId } from '../Authors/AuthorId.js';", "import type { Book } from './Book.js';") +
    klass(snippet(book + 'book-repository'), 'BookRepository'))
put('Features/Books/MongoBookRepository.ts', imports("import type { ObservableSource } from '@cratis/arc.core';",
    "import type { MongoCollection } from '@cratis/arc.mongodb';", "import type { Filter, Document } from 'mongodb';",
    "import type { AuthorId } from '../Authors/AuthorId.js';", "import { Book } from './Book.js';",
    "import { BookRepository } from './BookRepository.js';") +
    klass(snippet(book + 'mongodb-book-repository'), 'MongoBookRepository'))
put('Features/Books/Book.ts', imports(field, "import { argument, query, readModel, service, type ObservableSource } from '@cratis/arc.core';",
    "import { AuthorId } from '../Authors/AuthorId.js';", "import { BookId } from './BookId.js';",
    "import { BookTitle } from './BookTitle.js';", "import { BookRepository } from './BookRepository.js';") +
    klass(snippet(book + 'books-for-author'), 'Book'))
put('Features/Books/AddBook.ts', imports(field, "import { command, inject } from '@cratis/arc.core';",
    "import { AuthorId } from '../Authors/AuthorId.js';", "import { BookId } from './BookId.js';",
    "import { BookTitle } from './BookTitle.js';", "import { BookRepository } from './BookRepository.js';") +
    klass(snippet(book + 'add-book'), 'AddBook'))
# Chapter 5 supplies the protected class bodies and the role declarations.
roles_commands = snippet('tutorial/authorization/roles-on-command')
roles_queries = snippet('tutorial/authorization/roles-on-query')
command_role = re.search(r'(?m)^(@roles\([^\n]+\))\nexport class RegisterAuthor', roles_commands)
query_role = re.search(r'(?m)^    (@roles\([^\n]+\))\n    @query\(', roles_queries)
if not command_role or not query_role:
    raise ValueError('Missing chapter 5 role declaration')
for name in ('RegisterAuthor', 'RenameAuthor'):
    source_class = klass(roles_commands, name)
    if command_role[1] not in source_class:
        raise ValueError(f'Role not declared on {name}')
    target = out / f'Features/Authors/{name}.ts'
    text = target.read_text()
    original_class = klass(text, name)
    target.write_text(require_replace(text, original_class, source_class).replace('command,', 'command, roles,', 1))
query_class = klass(roles_queries, 'Author')
if query_role[1] not in query_class:
    raise ValueError('Role not declared on Author query')
target = out / 'Features/Authors/Author.ts'
text = target.read_text()
target.write_text(require_replace(text, klass(text, 'Author'), query_class).replace('query,', 'query, roles,', 1))
chapter_five = (a.arc_documentation / 'tutorial/authorization.mdx').read_text()
for name in ('AddBook', 'BooksForAuthor'):
    if name not in chapter_five:
        raise ValueError(f'Chapter 5 must protect {name}')
target = out / 'Features/Books/AddBook.ts'
text = target.read_text()
target.write_text(require_replace(text, '@command()\n', '@command()\n' + command_role[1] + '\n').replace('command,', 'command, roles,', 1))
target = out / 'Features/Books/Book.ts'
text = target.read_text()
target.write_text(require_replace(text, '    @query({ observable: true }', '    ' + query_role[1] + '\n    @query({ observable: true }').replace('query,', 'query, roles,', 1))

# Compose the actual published host steps, not a parallel hard-coded host.
put('main.ts', host_from_snippets(host_tab, snippet(book + 'mongodb-book-registration'),
                                 snippet('tutorial/validation/mongodb-unique-index'),
                                 snippet('tutorial/authorization/development-header-adapter')))
# Install instructions and backend compiler settings are those from the linked
# create-an-application guide; no workspace:^ dependency escapes into scratch.
put('package.json', '''{"name":"arc-tutorial-e2e","private":true,"type":"module","scripts":{
  "generate":"node generate.mjs","build":"npm run generate && tsc6","start":"node dist/main.js"}}''')
put('tsconfig.json', '''{"compilerOptions":{"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext",
  "lib":["ES2022","ESNext.Decorators"],"types":["node"],"strict":true,"verbatimModuleSyntax":true,
  "skipLibCheck":true,"rootDir":".","outDir":"dist"},"include":["main.ts","Features/**/*.ts"],
  "exclude":["Features/**/*.proxy.ts","Features/**/*.tsx"]}''')
put('generate.mjs', '''import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
const path = relative => fileURLToPath(new URL(relative, import.meta.url));
const cli = fileURLToPath(new URL('./cli.js', import.meta.resolve('@cratis/arc.proxygenerator')));
const result = spawnSync(process.execPath, [cli, '--project', path('./tsconfig.json'),
    '--artifacts', path('./Features'), '--output', path('./Features'), '--use-proxy-file-suffix',
    '--metadata', path('./Features/generatedMetadata.ts'), ...process.argv.slice(2)], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;''')
# Browser code is read directly from the shared chapters, not copied into this script.
first = (a.arc_documentation / 'tutorial/first-slice.mdx').read_text()
third = (a.arc_documentation / 'tutorial/books-and-relationships.mdx').read_text()
for filename, page in [('Authors.tsx', first), ('AddAuthor.tsx', first), ('App.tsx', third),
                       ('Catalog.tsx', third), ('AddBook.tsx', third), ('main.tsx', first)]:
    if filename in ('Authors.tsx', 'AddAuthor.tsx'):
        blocks = re.findall(r'```tsx\n(.*?)\n[ \t]*```', first, re.S)
        match = (None, blocks[0 if filename == 'Authors.tsx' else 1]) if len(blocks) >= 2 else None
    else:
        match = re.search(r'```tsx(?: title="src/' + filename + r'")?\n(.*?)\n[ \t]*```', page, re.S)
    if not match or (filename == 'main.tsx' and 'createRoot(' not in match[1]):
        if filename == 'main.tsx':
            match = re.search(r'```tsx\n(import \'reflect-metadata\';.*?)\n```', page, re.S)
        if not match:
            raise ValueError(f'Missing browser example {filename}')
    body = textwrap.dedent(match[1])
    if filename == 'Authors.tsx':
        body = body.replace("'./Authors/Author'", "'../Features/Authors/AllAuthors.proxy'")
    if filename == 'AddAuthor.tsx':
        body = body.replace("'./Authors/RegisterAuthor'", "'../Features/Authors/RegisterAuthor.proxy'")
    if filename == 'Catalog.tsx':
        body = body.replace("'./Authors/Author'", "'../Features/Authors/AllAuthors.proxy'")
        body = body.replace("'./Books/Book'", "'../Features/Books/BooksForAuthor.proxy'")
    if filename == 'AddBook.tsx':
        body = body.replace("'./Books/AddBook'", "'../Features/Books/AddBook.proxy'")
    put('src/' + filename, body)
style = re.search(r'```(?:tsx|typescript)\n(declare module \'@cratis/components/tokens\';.*?)\n```', first, re.S)
put('src/cratis-components-styles.d.ts', style[1])
html = re.search(r'```html\n(<!doctype html>.*?)\n```', first, re.S)
put('index.html', html[1])
web = re.search(r'```json\n(\{\n  "compilerOptions": \{\n    "target": "ES2022".*?\n\})\n```', first, re.S)
put('tsconfig.web.json', web[1])
vite = re.search(r'```(?:javascript|typescript)\n(import \{ defineConfig \} from \'vite\';.*?)\n```', first, re.S)
put('vite.config.ts', vite[1].replace("'http://localhost:5000'", "'http://127.0.0.1:3000'"))
print('Assembled the TypeScript tutorial from snippets and browser page fences')
