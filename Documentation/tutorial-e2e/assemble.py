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
p.add_argument('destination', type=Path)
p.add_argument('--arc-documentation', type=Path, required=True)
a = p.parse_args()
out = a.destination
out.mkdir(parents=True, exist_ok=True)


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
    decorator = text.rfind('\n@', 0, start)
    if decorator != -1 and not text[decorator + 1:start].strip().startswith('import '):
        start = decorator + 1
    brace = text.index('{', match.end())
    depth = 1
    i = brace + 1
    while depth:
        depth += (text[i] == '{') - (text[i] == '}')
        i += 1
    return text[start:i]


def put(name, body):
    target = out / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body.strip() + '\n')


def imports(*items):
    return '\n'.join(items) + '\n\n'

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
# Chapter 5 adds @roles to each command/query. Keep the bodies taken from their
# earlier tabs; the chapter 5 snippets must declare each protected artifact.
roles_commands = snippet('tutorial/authorization/roles-on-command')
roles_queries = snippet('tutorial/authorization/roles-on-query')
for name in ('RegisterAuthor', 'RenameAuthor'):
    if f'@roles(\'Librarian\')\nexport class {name}' not in roles_commands:
        raise ValueError(f'Role not declared on {name}')
for name in ('AddBook',):
    if name not in (a.arc_documentation / 'tutorial/authorization.mdx').read_text():
        raise ValueError('Chapter 5 must protect AddBook')
for name in ('RegisterAuthor', 'RenameAuthor', 'AddBook'):
    target = out / f'Features/{"Books" if name == "AddBook" else "Authors"}/{name}.ts'
    text = target.read_text().replace("import { command,", "import { roles, command,")
    target.write_text(text.replace('@command()\n', "@command()\n@roles('Librarian')\n", 1))
if "@roles('Librarian')" not in roles_queries:
    raise ValueError('Chapter 5 must protect AllAuthors')
for name, feature, query_name in (('Author', 'Authors', 'allAuthors'), ('Book', 'Books', 'booksForAuthor')):
    target = out / f'Features/{feature}/{name}.ts'
    text = target.read_text().replace('import { argument,', 'import { roles, argument,').replace('import { query,', 'import { roles, query,')
    target.write_text(text.replace('    @query({ observable: true }', "    @roles('Librarian')\n    @query({ observable: true }", 1))

# Host: start from the standalone tab, applying chapter 2's index helper,
# chapter 3's registration, and chapter 5's dev-only authentication.
registration = snippet(book + 'mongodb-book-registration')
for required in ('readModels: [Author, Book]', 'mongoCollection(Book)', 'BookRepository'):
    if required not in registration:
        raise ValueError(f'Chapter 3 registration lacks {required}')
index_tab = snippet('tutorial/validation/mongodb-unique-index')
header_tab = snippet('tutorial/authorization/development-header-adapter')
if 'microsoftIdentityPlatform()' not in header_tab or 'createIndex(' not in index_tab:
    raise ValueError('Missing chapter 2 or 5 host step')
put('main.ts', imports("import { ArcApplication, microsoftIdentityPlatform, Severity } from '@cratis/arc.core';",
    "import { mongoCollection } from '@cratis/arc.mongodb';", "import type { Filter, Document } from 'mongodb';",
    "import { metadata } from './Features/generatedMetadata.js';",
    "import { Author } from './Features/Authors/Author.js';", "import { AuthorRepository } from './Features/Authors/AuthorRepository.js';",
    "import { MongoAuthorRepository } from './Features/Authors/MongoAuthorRepository.js';",
    "import { Book } from './Features/Books/Book.js';", "import { BookRepository } from './Features/Books/BookRepository.js';",
    "import { MongoBookRepository } from './Features/Books/MongoBookRepository.js';") + """
const development = process.env.NODE_ENV === 'development';
const builder = ArcApplication.createBuilder({ tenancy: { resolve: () => 'default' },
    development, authentication: development ? [microsoftIdentityPlatform()] : [] });
builder.useGeneratedMetadata(metadata);
builder.withMongoDB({ server: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
    database: process.env.TUTORIAL_DATABASE ?? 'Library', readModels: [Author, Book] });
builder.services.addScoped(AuthorRepository, async scope =>
    new MongoAuthorRepository(await scope.resolve(mongoCollection(Author))));
builder.services.addScoped(BookRepository, async scope =>
    new MongoBookRepository(await scope.resolve(mongoCollection(Book))));
await builder.discover(new URL('./Features/', import.meta.url));
const app = await builder.build();
try {
    const scope = app.server.services.createScope({ tenantId: 'default', correlationId: crypto.randomUUID(),
        principal: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Warning });
    try {
        const collection = await scope.resolve(mongoCollection(Author));
        await collection.native.createIndex({ [collection.codec.fieldName('name')]: 1 },
            { unique: true, name: 'unique_author_name' });
    } finally { await scope.dispose(); }
    await app.run({ port: Number(process.env.PORT ?? 3000) });
} finally { await app.dispose(); }
""")
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
