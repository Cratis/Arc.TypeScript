#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Check and compile every shared-docs TypeScript snippet against this repository's packages.

`Documentation/client-snippets/**` is not a documentation page. It is the TypeScript side
of the backend language tabs that the shared Arc pages render through
`<ArcBackendTabs snippet="..." />`, next to the C# snippets in Arc and the Kotlin and Java
snippets in Arc.Kotlin. Nothing in a Markdown file is compiled by anything else, so without
this gate a renamed decorator or an invented API keeps rendering on the published site.

The gate checks two things:

* The snippet contract. Every file holds exactly one fence and nothing else. The fence is
  either `typescript`, or `text` holding the explicit statement that TypeScript does not
  support the workflow yet. The set of snippet ids equals the checked-in inventory in
  `SNIPPETS`, and, when the Arc checkout is available (`../Arc/Documentation` by default),
  the ids the shared pages actually ask a TypeScript tab for.
* Compilation. Each real snippet becomes its own module in a throwaway project under the
  system temporary folder. The snippet text is emitted verbatim; only its single-line
  imports are hoisted above a host class when the snippet is a class-member fragment.
  Domain types the snippet uses but does not declare (`AuthorId`, `AuthorRepository`, ...)
  come from the small fixture modules below, imported by name. Framework APIs are never
  supplied: a snippet that is a whole module imports them itself, and a member fragment's
  context names the exact imports it relies on. The project extends this repository's
  `tsconfig.json` (strict, standard decorators, `verbatimModuleSyntax`,
  `noUncheckedIndexedAccess`) and resolves `@cratis/arc.core`, `@cratis/fundamentals`,
  `zod` and `vitest` from this repository's `node_modules`, then runs the workspace `tsc`.

Module resolution is `Bundler`, matching the repository's example applications.
Fundamentals 7.19.6 also resolves under NodeNext; `--self-test` plants a concept
type error to prove the configured compiler sees the actual declaration types.

Usage:
    python3 Documentation/validate-client-snippets.py [--arc-documentation PATH] [--keep]
    python3 Documentation/validate-client-snippets.py --self-test

Exit codes:
    0  every snippet satisfied the contract and compiled
    1  a snippet violated the contract or failed to compile, including finding no snippets
    2  the check could not run (no `node_modules`, no workspace `tsc`, packages not built)
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SNIPPET_ROOT = REPO_ROOT / "Documentation" / "client-snippets"
DEFAULT_ARC_DOCUMENTATION = REPO_ROOT.parent / "Arc" / "Documentation"
NODE_MODULES = REPO_ROOT / "node_modules"
TSC = NODE_MODULES / ".bin" / "tsc"
BASE_TSCONFIG = REPO_ROOT / "tsconfig.json"
BUILD_OUTPUTS = (
    REPO_ROOT / "Source" / "Core" / "dist" / "index.d.ts",
    REPO_ROOT / "Source" / "Core" / "dist" / "index.js",
)

EXIT_CLEAN, EXIT_DEFECTS, EXIT_BLOCKED = 0, 1, 2

SNIPPET_LANGUAGE = "typescript"
VARIANT_KEY = "typescript"

# A backend without the workflow keeps its tab with an explicit statement instead of
# dropping out of the tab group, as Arc and Arc.Kotlin do. Such a snippet is a `text`
# fence containing this marker and is deliberately not compiled.
UNSUPPORTED_FENCE_LANGUAGE = "text"
UNSUPPORTED_MARKER = "does not support this workflow yet"

MACRO_RE = re.compile(r"<ArcBackendTabs\b([^>]*?)/>")
ATTRIBUTE_RE = re.compile(r'([A-Za-z]+)="([^"]*)"')
FENCE_RE = re.compile(r"\A```([^\s`]*)[^\n]*\n(.*)\n```\Z", re.DOTALL)
IMPORT_RE = re.compile(r"^import\s.*\sfrom\s+'[^']+';$|^import\s+'[^']+';$")
IMPORT_BINDINGS_RE = re.compile(r"^import\s+(?:type\s+)?(.*?)\s+from\s")
EXPORT_RE = re.compile(r"^export\s+(?:abstract\s+)?(class|enum|interface|type|const|function)\s+([A-Za-z_$][\w$]*)",
                       re.MULTILINE)
DECLARATION_RE = re.compile(r"\b(?:class|interface|type|enum|function|const|let|var)\s+([A-Za-z_$][\w$]*)")
DIAGNOSTIC_RE = re.compile(r"^(?P<file>[^\s(]+\.ts)\((?P<line>\d+),(?P<column>\d+)\): error (?P<message>.*)$")
SNIPPET_PLACEHOLDER = "<<SNIPPET>>"


class SnippetError(Exception):
    """The exception that is thrown when a snippet violates the snippet contract."""


class Blocked(Exception):
    """The exception that is thrown when the check cannot run at all."""


@dataclass(frozen=True)
class Context:
    """How a snippet becomes a compilable module.

    `host` wraps a class-member fragment; it is the class the members belong to, with
    `<<SNIPPET>>` where the fragment goes. `imports` are the framework imports a member
    fragment relies on without showing them. `siblings` are other snippets a snippet imports
    by relative path, as `(module file stem, snippet id)`, so a spec compiles against the
    very command snippet the page shows beside it.
    """

    host: str = ""
    imports: tuple[str, ...] = ()
    siblings: tuple[tuple[str, str], ...] = ()


MODULE = Context()

FUNDAMENTALS_FIELD = "import { field } from '@cratis/fundamentals';"

AUTHOR_READ_MODEL = """
@readModel()
export class Author {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

<<SNIPPET>>
}
"""

ASSESS_LOAN_COMMAND = """
@command()
export class AssessLoan {
    @field(LoanId) loanId!: LoanId;
    @field(ApplicantId) applicant!: ApplicantId;

<<SNIPPET>>
}
"""

REGISTER_AUTHOR_COMMAND = """
@command()
export class RegisterAuthor {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

<<SNIPPET>>
}
"""

# The checked-in inventory: every id the shared Arc pages ask a TypeScript tab for.
# `None` means the file must state that TypeScript does not support the workflow yet.
SNIPPETS: dict[str, Context | None] = {
    "understanding-identity-and-access/identity-provider": MODULE,
    "understanding-identity-and-access/authorization": MODULE,
    "understanding-the-proxy-boundary/register-author": MODULE,
    "understanding-the-proxy-boundary/rename-property": MODULE,
    "tutorial/first-slice/author-slice": MODULE,
    "tutorial/validation/author-name-rule": MODULE,
    "tutorial/validation/duplicate-name-rule": MODULE,
    "tutorial/authorization/roles-on-command": MODULE,
    "tutorial/authorization/roles-on-query": MODULE,
    "tutorial/books-and-relationships/book-concepts": MODULE,
    "tutorial/books-and-relationships/add-book": MODULE,
    "tutorial/books-and-relationships/books-for-author": MODULE,
    "tutorial/real-time/one-shot-query": Context(
        host=AUTHOR_READ_MODEL,
        imports=(FUNDAMENTALS_FIELD, "import { query, readModel, service } from '@cratis/arc.core';")),
    "tutorial/real-time/observable-query": Context(
        host=AUTHOR_READ_MODEL,
        imports=(FUNDAMENTALS_FIELD,
                 "import { query, readModel, service } from '@cratis/arc.core';", "import type { BehaviorSubject } from 'rxjs';")),
    "scenarios/provide-data-to-a-command/assess-loan": MODULE,
    "scenarios/provide-data-to-a-command/test-the-decision": Context(
        siblings=(("AssessLoan", "scenarios/provide-data-to-a-command/assess-loan"),)),
    "scenarios/provide-data-to-a-command/several-values": Context(
        host=ASSESS_LOAN_COMMAND,
        imports=(FUNDAMENTALS_FIELD, "import { command, currentServices } from '@cratis/arc.core';")),
    "scenarios/provide-data-to-a-command/cancellation": MODULE,
    "scenarios/provide-data-to-a-command/short-circuit": Context(
        host=ASSESS_LOAN_COMMAND,
        imports=(FUNDAMENTALS_FIELD,
                 "import { command, currentServices, rejected, validation, type Outcome } from '@cratis/arc.core';")),
    "scenarios/provide-data-to-a-command/provider-owned-state": MODULE,
    "scenarios/validate-a-command/concept-rule": MODULE,
    "scenarios/validate-a-command/command-rule": MODULE,
    "scenarios/validate-a-command/state-rule": MODULE,
    "scenarios/validate-a-command/service-rule": MODULE,
    "scenarios/return-a-result-or-error/handle-result": Context(
        host=REGISTER_AUTHOR_COMMAND,
        imports=(FUNDAMENTALS_FIELD,
                 "import { command, inject, rejected, validation, type Outcome } from '@cratis/arc.core';")),
    "scenarios/query-related-data/books-for-author": MODULE,
    "scenarios/test-a-command/command-under-test": MODULE,
    "scenarios/test-a-command/spec": Context(
        siblings=(("RecordAuthor", "scenarios/test-a-command/command-under-test"),)),
    # Command-key model resolution is available for handlers and provide(), not validator parameters.
    # The in-memory Chronicle scenario pins models but does not materialize projections from seed events.
    "scenarios/use-current-state-in-a-command/rename-author": MODULE,
    "scenarios/use-current-state-in-a-command/rename-author-validator": MODULE,
    "scenarios/use-current-state-in-a-command/register-customer-validator": MODULE,
    "scenarios/use-current-state-in-a-command/required-order-state": MODULE,
    "scenarios/use-current-state-in-a-command/chronicle-commands": MODULE,
    "scenarios/use-current-state-in-a-command/seed-events": None,
    "scenarios/use-current-state-in-a-command/pin-read-model": MODULE,
    "frontend/index/open-account": MODULE,
    "frontend/react/commands/index/command-payload": MODULE,
    "frontend/react/proxy-generation/open-debit-account": MODULE,
    "frontend/react/queries/usage/parameterized-query": MODULE,
    "frontend/react/command-form/validation/profile-command": MODULE,
    "frontend/react/command-form/auto-server-validation/server-only-rule": MODULE,
}

# Application-owned domain types the snippets reference without declaring. Keep them
# minimal: they exist to give a fragment the types it uses, not to model anything. Every
# exported name must be unique across fixtures, because a snippet imports it by name.
FIXTURES: dict[str, str] = {
    "library": """
        import { ConceptAs, field, Guid } from '@cratis/fundamentals';
        import { command, inject, readModel, type ObservableSource } from '@cratis/arc.core';
        import type { BehaviorSubject } from 'rxjs';

        export class AuthorId extends ConceptAs<Guid> {
            static readonly valueType = Guid;
            static create(): AuthorId { return new AuthorId(Guid.create()); }
        }
        export class AuthorName extends ConceptAs<string> { static readonly valueType = String; }
        export class BookId extends ConceptAs<Guid> { static readonly valueType = Guid; }
        export class BookTitle extends ConceptAs<string> { static readonly valueType = String; }

        @readModel()
        export class Author {
            @field(AuthorId) id!: AuthorId;
            @field(AuthorName) name!: AuthorName;
        }

        @readModel()
        export class Book {
            @field(BookId) id!: BookId;
            @field(AuthorId) authorId!: AuthorId;
            @field(BookTitle) title!: BookTitle;
        }

        export abstract class AuthorRepository {
            abstract save(author: Author): Promise<void>;
            abstract all(): Promise<Author[]>;
            abstract observeAll(): BehaviorSubject<Author[]>;
            abstract findById(id: AuthorId, signal?: AbortSignal): Promise<Author | undefined>;
            abstract existsByName(name: AuthorName, signal?: AbortSignal): Promise<boolean>;
        }

        export abstract class BookRepository {
            abstract save(book: Book): Promise<void>;
            abstract observeForAuthor(authorId: AuthorId): ObservableSource<Book[]>;
        }

        @command()
        export class RegisterAuthor {
            @field(AuthorId) id!: AuthorId;
            @field(AuthorName) name!: AuthorName;

            @inject(AuthorRepository)
            handle(authors: AuthorRepository): Promise<void> { return authors.save({ id: this.id, name: this.name }); }
        }

        @command()
        export class RenameAuthor {
            @field(AuthorId) id!: AuthorId;
            @field(AuthorName) newName!: AuthorName;
            handle(): void {}
        }
    """,
    "loans": """
        import { ConceptAs, Guid } from '@cratis/fundamentals';

        export class LoanId extends ConceptAs<Guid> {
            static readonly valueType = Guid;
            static create(): LoanId { return new LoanId(Guid.create()); }
        }
        export class ApplicantId extends ConceptAs<Guid> {
            static readonly valueType = Guid;
            static create(): ApplicantId { return new ApplicantId(Guid.create()); }
        }
        export class CreditScore extends ConceptAs<number> { static readonly valueType = Number; }
        export enum RiskBand { Low = 'Low', Medium = 'Medium', High = 'High' }
        export interface CreditProfile { score: CreditScore; band: RiskBand }

        export class LoanAssessment {
            constructor(readonly loanId: LoanId, readonly score: CreditScore, readonly band?: RiskBand) {}
        }

        export abstract class CreditBureau {
            abstract scoreFor(applicant: ApplicantId, signal?: AbortSignal): Promise<CreditScore>;
            abstract findScore(applicant: ApplicantId, signal?: AbortSignal): Promise<CreditScore | undefined>;
        }

        export abstract class RiskModel {
            abstract bandFor(applicant: ApplicantId): Promise<RiskBand>;
        }
    """,
    "orders": """
        import { ConceptAs, field, Guid } from '@cratis/fundamentals';
        import { command } from '@cratis/arc.core';

        export class OrderId extends ConceptAs<Guid> { static readonly valueType = Guid; }
        export enum OrderStatus { Draft = 'Draft', ReadyForSubmission = 'ReadyForSubmission', Submitted = 'Submitted' }

        export class Order {
            constructor(readonly id: OrderId, readonly status: OrderStatus) {}
        }

        export abstract class OrderRepository {
            abstract findById(id: OrderId, signal?: AbortSignal): Promise<Order | undefined>;
        }

        @command()
        export class SubmitOrder {
            @field(OrderId) id!: OrderId;
            handle(): void {}
        }
    """,
    "customers": """
        import { ConceptAs, field } from '@cratis/fundamentals';
        import { command } from '@cratis/arc.core';

        export class CustomerId extends ConceptAs<string> { static readonly valueType = String; }
        export class CustomerName extends ConceptAs<string> { static readonly valueType = String; }

        export class Customer {
            constructor(readonly id: CustomerId, readonly name: CustomerName) {}
        }

        export abstract class CustomerRepository {
            abstract findById(id: CustomerId, signal?: AbortSignal): Promise<Customer | undefined>;
        }

        @command()
        export class RegisterCustomer {
            @field(CustomerId) id!: CustomerId;
            @field(CustomerName) name!: CustomerName;
            handle(): void {}
        }
    """,
    "accounts": """
        import { ConceptAs, field } from '@cratis/fundamentals';
        import { readModel } from '@cratis/arc.core';
        import { CustomerId } from './customers.js';

        export class AccountId extends ConceptAs<string> { static readonly valueType = String; }
        export class AccountHolder extends ConceptAs<string> { static readonly valueType = String; }
        export class AccountName extends ConceptAs<string> { static readonly valueType = String; }

        export class Account {
            constructor(readonly id: AccountId, readonly owner: AccountHolder) {}
        }

        @readModel()
        export class DebitAccount {
            @field(AccountId) id!: AccountId;
            @field(AccountName) name!: AccountName;
        }

        export abstract class AccountRepository {
            abstract save(account: Account): Promise<void>;
        }

        export abstract class AccountService {
            abstract open(accountId: AccountId, name: AccountName, owner: CustomerId): Promise<void>;
        }

        export abstract class DebitAccountRepository {
            abstract findByNameStartingWith(prefix: string): Promise<DebitAccount[]>;
        }
    """,
    "profiles": """
        import { ConceptAs, field } from '@cratis/fundamentals';
        import { command } from '@cratis/arc.core';

        export class ProfileName extends ConceptAs<string> { static readonly valueType = String; }
        export class EmailAddress extends ConceptAs<string> { static readonly valueType = String; }

        @command()
        export class UpdateProfile {
            @field(ProfileName) name!: ProfileName;
            @field(EmailAddress) email!: EmailAddress;
            handle(): void {}
        }
    """,
    "members": """
        export class Member {
            constructor(readonly id: string, readonly subject: string, readonly role: string, readonly name: string) {}
        }

        export abstract class MemberRepository {
            abstract bySubject(subject: string): Promise<Member | undefined>;
        }

        export class MongoMemberRepository extends MemberRepository {
            async bySubject(): Promise<Member | undefined> { return undefined; }
        }
    """,
}


@dataclass(frozen=True)
class Snippet:
    """One parsed snippet file: its id, source path, and TypeScript code (None when unsupported)."""

    id: str
    path: Path
    code: str | None


def relative(path: Path) -> str:
    """Show a path relative to the repository when it is inside it."""
    try:
        return path.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return str(path)


def discover(root: Path, problems: list[str]) -> dict[str, Path]:
    """Map every snippet id below `root` to its file, reporting duplicate ids."""
    files: dict[str, Path] = {}
    if not root.is_dir():
        return files
    for path in sorted([*root.rglob("*.md"), *root.rglob("*.mdx")]):
        snippet_id = path.relative_to(root).with_suffix("").as_posix()
        if snippet_id in files:
            problems.append(f"{relative(path)}: duplicate snippet id {snippet_id} (also {relative(files[snippet_id])})")
            continue
        files[snippet_id] = path
    return files


def parse(snippet_id: str, path: Path) -> Snippet:
    """Parse a snippet file into its TypeScript code, or None for an unsupported-workflow marker."""
    raw = path.read_text(encoding="utf-8")
    fence_lines = [line for line in raw.splitlines() if line.startswith("```")]
    if len(fence_lines) != 2:
        raise SnippetError(f"{relative(path)}: must contain exactly one fenced block, found {len(fence_lines) // 2 or len(fence_lines)}")
    match = FENCE_RE.match(raw.strip())
    if not match:
        raise SnippetError(f"{relative(path)}: must contain only the fenced block, with nothing before or after it")
    language, code = match.group(1), match.group(2)
    if language == UNSUPPORTED_FENCE_LANGUAGE:
        if UNSUPPORTED_MARKER not in code:
            raise SnippetError(f"{relative(path)}: a text fence must state that TypeScript {UNSUPPORTED_MARKER}")
        return Snippet(snippet_id, path, None)
    if language != SNIPPET_LANGUAGE:
        raise SnippetError(f"{relative(path)}: fence language must be {SNIPPET_LANGUAGE!r} or {UNSUPPORTED_FENCE_LANGUAGE!r}, "
                           f"got {language or 'none'!r}")
    if UNSUPPORTED_MARKER in code:
        raise SnippetError(f"{relative(path)}: the unsupported-workflow statement belongs in a text fence")
    return Snippet(snippet_id, path, code)


def shared_inventory(arc_documentation: Path) -> set[str]:
    """Read the snippet ids the shared Arc pages ask a TypeScript tab for."""
    ids: set[str] = set()
    pages = 0
    for page in sorted(arc_documentation.rglob("*.mdx")):
        if "client-snippets" in page.relative_to(arc_documentation).parts:
            continue
        pages += 1
        for macro in MACRO_RE.finditer(page.read_text(encoding="utf-8")):
            attributes = dict(ATTRIBUTE_RE.findall(macro.group(1)))
            snippet = attributes.get("snippet")
            if not snippet:
                raise SnippetError(f"{page}: <ArcBackendTabs> without a snippet attribute")
            variants = attributes.get("variants")
            if variants is not None and VARIANT_KEY not in [value.strip() for value in variants.split(",")]:
                continue
            ids.add(snippet)
    if not ids:
        raise SnippetError(f"{arc_documentation}: read {pages} MDX pages and found no <ArcBackendTabs> for TypeScript; "
                           "the shared inventory cannot be empty")
    return ids


def check_contract(root: Path, inventory: dict[str, Context | None], arc_documentation: Path | None,
                   problems: list[str]) -> list[Snippet]:
    """Check files, ids and markers; return the parsed snippets that are well formed."""
    files = discover(root, problems)
    if not files:
        problems.append(f"{relative(root)}: found 0 snippets; the check would pass vacuously")
        return []

    for snippet_id in sorted(files.keys() - inventory.keys()):
        problems.append(f"{relative(files[snippet_id])}: unknown snippet id {snippet_id}; add it to SNIPPETS or remove the file")
    for snippet_id in sorted(inventory.keys() - files.keys()):
        problems.append(f"missing snippet {snippet_id}: expected {relative(root / (snippet_id + '.md'))}")

    if arc_documentation is not None:
        try:
            shared = shared_inventory(arc_documentation)
        except SnippetError as error:
            problems.append(str(error))
        else:
            for snippet_id in sorted(shared - inventory.keys()):
                problems.append(f"shared Arc page asks for {snippet_id}, which is not in the TypeScript inventory")
            for snippet_id in sorted(inventory.keys() - shared):
                problems.append(f"{snippet_id} is in the TypeScript inventory but no shared Arc page uses it")

    snippets: list[Snippet] = []
    for snippet_id, path in sorted(files.items()):
        if snippet_id not in inventory:
            continue
        try:
            snippet = parse(snippet_id, path)
        except SnippetError as error:
            problems.append(str(error))
            continue
        expected_unsupported = inventory[snippet_id] is None
        if expected_unsupported and snippet.code is not None:
            problems.append(f"{relative(path)}: SNIPPETS marks {snippet_id} unsupported, but the file has TypeScript; "
                            "give it a context")
        elif not expected_unsupported and snippet.code is None:
            problems.append(f"{relative(path)}: states the workflow is unsupported, but SNIPPETS has a context for it")
        else:
            snippets.append(snippet)
    return snippets


def fixture_exports(fixtures: dict[str, str]) -> dict[str, tuple[str, bool]]:
    """Map every exported fixture name to its fixture module and whether it is type-only."""
    exports: dict[str, tuple[str, bool]] = {}
    for fixture, source in fixtures.items():
        for kind, name in EXPORT_RE.findall(textwrap.dedent(source)):
            if name in exports:
                raise SnippetError(f"fixture name {name} is exported by both {exports[name][0]} and {fixture}")
            exports[name] = (fixture, kind in ("interface", "type"))
    return exports


def imported_names(import_lines: list[str]) -> set[str]:
    """Collect the local names bound by single-line import declarations."""
    names: set[str] = set()
    for line in import_lines:
        match = IMPORT_BINDINGS_RE.match(line)
        if not match:
            continue
        bindings = match.group(1)
        for part in re.split(r"[{},]", bindings):
            part = re.sub(r"^\s*type\s+", "", part).strip()
            if part.startswith("* as "):
                part = part[len("* as "):]
            if " as " in part:
                part = part.split(" as ")[1]
            if part:
                names.add(part.strip())
    return names


def module_source(snippet: Snippet, context: Context, exports: dict[str, tuple[str, bool]]) -> str:
    """Build the compilable module for a snippet, emitting the snippet body verbatim."""
    assert snippet.code is not None
    imports: list[str] = []
    body: list[str] = []
    for line in snippet.code.splitlines():
        if line.startswith("import "):
            if not IMPORT_RE.match(line):
                raise SnippetError(f"{relative(snippet.path)}: keep each import on one line: {line}")
            imports.append(line)
        else:
            body.append(line)
    code = "\n".join(body).strip("\n")
    if context.host:
        code = textwrap.dedent(context.host).strip("\n").replace(SNIPPET_PLACEHOLDER, code)
    all_imports = [*context.imports, *imports]
    taken = set(DECLARATION_RE.findall(code)) | imported_names(all_imports)
    fixture_imports: dict[str, list[str]] = {}
    for name, (fixture, type_only) in sorted(exports.items()):
        if name in taken or not re.search(rf"(?<![\w$.]){re.escape(name)}(?![\w$])", code):
            continue
        fixture_imports.setdefault(fixture, []).append(f"type {name}" if type_only else name)
    lines = ["// Generated by Documentation/validate-client-snippets.py from " + relative(snippet.path)]
    lines += [f"import {{ {', '.join(names)} }} from '../../fixtures/{fixture}.js';"
              for fixture, names in sorted(fixture_imports.items())]
    lines += [*all_imports, "", code, ""]
    return "\n".join(lines)


def slug(snippet_id: str) -> str:
    """Turn a snippet id into a directory name."""
    return re.sub(r"[^A-Za-z0-9]+", "_", snippet_id)


def ensure_toolchain() -> None:
    """Raise Blocked when the workspace cannot compile snippets."""
    if not NODE_MODULES.is_dir():
        raise Blocked(f"{relative(NODE_MODULES)} is missing; run `yarn install`")
    if not TSC.exists():
        raise Blocked(f"{relative(TSC)} is missing; run `yarn install`")
    missing = [relative(path) for path in BUILD_OUTPUTS if not path.is_file()]
    if missing:
        raise Blocked(f"packages are not built ({', '.join(missing)} missing); run `yarn build`")


def write_project(project: Path, snippets: list[Snippet], inventory: dict[str, Context | None],
                  fixtures: dict[str, str]) -> dict[str, str]:
    """Write the throwaway project and return a map from snippet directory to snippet id."""
    exports = fixture_exports(fixtures)
    by_id = {snippet.id: snippet for snippet in snippets}
    files: list[str] = []
    (project / "package.json").write_text(json.dumps({"private": True, "type": "module"}) + "\n", encoding="utf-8")
    (project / "node_modules").symlink_to(NODE_MODULES, target_is_directory=True)
    (project / "fixtures").mkdir()
    for fixture, source in fixtures.items():
        (project / "fixtures" / f"{fixture}.ts").write_text(textwrap.dedent(source).strip() + "\n", encoding="utf-8")
        files.append(f"fixtures/{fixture}.ts")
    directories: dict[str, str] = {}
    for snippet in snippets:
        context = inventory[snippet.id]
        assert context is not None
        directory = project / "snippets" / slug(snippet.id)
        directory.mkdir(parents=True)
        directories[f"snippets/{slug(snippet.id)}"] = snippet.id
        (directory / "snippet.ts").write_text(module_source(snippet, context, exports), encoding="utf-8")
        files.append(f"snippets/{slug(snippet.id)}/snippet.ts")
        for stem, sibling_id in context.siblings:
            sibling = by_id.get(sibling_id)
            sibling_context = inventory.get(sibling_id)
            if sibling is None or sibling_context is None:
                raise SnippetError(f"{snippet.id} imports ./{stem}.js from {sibling_id}, which is not a compilable snippet")
            (directory / f"{stem}.ts").write_text(module_source(sibling, sibling_context, exports), encoding="utf-8")
            files.append(f"snippets/{slug(snippet.id)}/{stem}.ts")
    tsconfig = {
        "extends": str(BASE_TSCONFIG),
        "compilerOptions": {
            "module": "ESNext",
            "moduleResolution": "Bundler",
            "composite": False,
            "declaration": False,
            "incremental": False,
            "noEmit": True,
        },
        "files": files,
    }
    (project / "tsconfig.json").write_text(json.dumps(tsconfig, indent=4) + "\n", encoding="utf-8")
    return directories


def compile_snippets(snippets: list[Snippet], inventory: dict[str, Context | None], fixtures: dict[str, str],
                     keep: bool = False) -> dict[str, list[str]]:
    """Compile the snippets; return diagnostics keyed by snippet id (or `fixtures`)."""
    ensure_toolchain()
    project = Path(tempfile.mkdtemp(prefix="arc-typescript-snippets-"))
    try:
        directories = write_project(project, snippets, inventory, fixtures)
        completed = subprocess.run([str(TSC), "-p", "tsconfig.json", "--pretty", "false"], cwd=project,
                                   capture_output=True, text=True, check=False)
        output = (completed.stdout + completed.stderr).strip()
        failures: dict[str, list[str]] = {}
        for line in output.splitlines():
            diagnostic = DIAGNOSTIC_RE.match(line)
            if not diagnostic:
                if failures and line.startswith(" "):
                    failures[next(reversed(failures))].append(line)
                continue
            file = diagnostic.group("file")
            owner = directories.get(str(Path(file).parent.as_posix()), "fixtures")
            failures.setdefault(owner, []).append(line)
        if completed.returncode != 0 and not failures:
            raise Blocked(f"tsc exited with {completed.returncode} without diagnostics:\n{output}")
        if completed.returncode == 0 and failures:
            raise Blocked(f"tsc reported diagnostics but exited 0:\n{output}")
        if failures and keep is False:
            for snippet_id in failures:
                source = project / "snippets" / slug(snippet_id) / "snippet.ts"
                if source.is_file():
                    numbered = [f"{index:4} | {text}" for index, text in
                                enumerate(source.read_text(encoding="utf-8").splitlines(), start=1)]
                    failures[snippet_id].append("  generated snippet.ts:\n" + "\n".join(numbered))
        return failures
    finally:
        if keep:
            print(f"Kept the generated project in {project}")
        else:
            shutil.rmtree(project, ignore_errors=True)


def validate(root: Path, inventory: dict[str, Context | None], arc_documentation: Path | None,
             fixtures: dict[str, str], keep: bool = False) -> tuple[list[str], int, int]:
    """Run the whole gate; return problems, compiled count and unsupported count."""
    problems: list[str] = []
    snippets = check_contract(root, inventory, arc_documentation, problems)
    real = [snippet for snippet in snippets if snippet.code is not None]
    unsupported = len(snippets) - len(real)
    if real:
        try:
            failures = compile_snippets(real, inventory, fixtures, keep)
        except SnippetError as error:
            problems.append(str(error))
        else:
            for owner, lines in sorted(failures.items()):
                problems.append(f"{owner} does not compile:\n" + "\n".join(f"    {line}" for line in lines))
    return problems, len(real), unsupported


def run(arguments: argparse.Namespace) -> int:
    """Validate the repository's snippets."""
    arc_documentation: Path | None = arguments.arc_documentation
    if arc_documentation is not None and not arc_documentation.is_dir():
        raise Blocked(f"--arc-documentation {arc_documentation} is not a directory")
    if arc_documentation is None:
        if DEFAULT_ARC_DOCUMENTATION.is_dir():
            arc_documentation = DEFAULT_ARC_DOCUMENTATION
        else:
            print(f"Note: {DEFAULT_ARC_DOCUMENTATION} is not checked out; compared ids with the checked-in "
                  f"inventory of {len(SNIPPETS)} only.")
    problems, compiled, unsupported = validate(SNIPPET_ROOT, SNIPPETS, arc_documentation, FIXTURES, arguments.keep)
    if problems:
        for problem in problems:
            print(f"FAIL {problem}", file=sys.stderr)
        print(f"{len(problems)} snippet problem(s).", file=sys.stderr)
        return EXIT_DEFECTS
    shared = f", matched against {arc_documentation}" if arc_documentation else ""
    print(f"Checked {compiled + unsupported} TypeScript snippet ids{shared}: {compiled} compiled, "
          f"{unsupported} state the workflow is unsupported.")
    return EXIT_CLEAN


VALID_COMMAND = """```typescript
import { field } from '@cratis/fundamentals';
import { command, inject } from '@cratis/arc.core';

@command()
export class RegisterAuthor {
    @field(AuthorId) id!: AuthorId;
    @field(AuthorName) name!: AuthorName;

    @inject(AuthorRepository)
    handle(authors: AuthorRepository): Promise<void> {
        return authors.save({ id: this.id, name: this.name });
    }
}
```
"""

UNSUPPORTED = "```text\nTypeScript does not support this workflow yet.\n```\n"

# Snippets that must fail to compile, each proving one part of the environment is live,
# with the diagnostic that proves it failed for that reason and not another.
PLANTED_COMPILE_FAILURES: dict[str, tuple[str, str]] = {
    # An invented framework API: the package's real declarations are resolved.
    "self-test/invented-api": (
        "```typescript\nimport { commandHandler } from '@cratis/arc.core';\n\nvoid commandHandler;\n```\n", "TS2305"),
    # A wrong concept value: Fundamentals types are live, not degraded to `any`.
    "self-test/concept-type": ("```typescript\nexport const name = new AuthorName(42);\n```\n", "TS2345"),
    # An injected token that does not match the handler: decorator signatures are checked.
    "self-test/injection-signature": (
        VALID_COMMAND.replace("@inject(AuthorRepository)", "@inject(BookRepository)"), "TS1241"),
    # An implicit any: strict mode is on.
    "self-test/strict": ("```typescript\nexport function untyped(value) { return value; }\n```\n", "TS7006"),
    # A type imported as a value: verbatimModuleSyntax is on.
    "self-test/type-only-import": (
        "```typescript\nimport { ObservableSource } from '@cratis/arc.core';\n\n"
        "export type Source = ObservableSource<string>;\n```\n", "TS1484"),
}


def plant(root: Path, files: dict[str, str]) -> None:
    """Write snippet files below a temporary snippet root."""
    for snippet_id, content in files.items():
        path = root / f"{snippet_id}.md"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


def self_test() -> int:
    """Plant violations and require the gate to catch every one of them."""
    inventory: dict[str, Context | None] = {"a/command": MODULE, "a/unsupported": None}
    clean = {"a/command": VALID_COMMAND, "a/unsupported": UNSUPPORTED}
    macros = ('<ArcBackendTabs snippet="a/command" />\n<ArcBackendTabs snippet="a/unsupported" />\n'
              '<ArcBackendTabs snippet="a/other-backends-only" variants="csharp,kotlin,java" />\n')
    contract_cases: list[tuple[str, dict[str, str], str, str]] = [
        ("clean snippets and shared pages", clean, macros, ""),
        ("no snippets at all", {}, macros, "found 0 snippets"),
        ("a snippet id nobody asked for", {**clean, "a/stray": VALID_COMMAND}, macros, "unknown snippet id a/stray"),
        ("a missing snippet", {"a/command": VALID_COMMAND}, macros, "missing snippet a/unsupported"),
        ("two fences", {**clean, "a/command": VALID_COMMAND + VALID_COMMAND}, macros, "exactly one fenced block"),
        ("text around the fence", {**clean, "a/command": "Intro\n\n" + VALID_COMMAND}, macros, "only the fenced block"),
        ("a ts language tag", {**clean, "a/command": VALID_COMMAND.replace("```typescript", "```ts")}, macros,
         "fence language must be"),
        ("a text fence without the statement", {**clean, "a/unsupported": "```text\nNot yet.\n```\n"}, macros,
         "must state that TypeScript"),
        ("a marker where TypeScript is expected", {**clean, "a/command": UNSUPPORTED}, macros,
         "SNIPPETS has a context"),
        ("code where the marker is expected", {**clean, "a/unsupported": VALID_COMMAND}, macros,
         "marks a/unsupported unsupported"),
        ("a shared page asking for an unknown id", clean, macros + '<ArcBackendTabs snippet="a/new" />\n',
         "asks for a/new"),
        ("an inventory id no shared page uses", clean, '<ArcBackendTabs snippet="a/command" />\n',
         "no shared Arc page uses it"),
        ("shared pages without any macro", clean, "No tabs here.\n", "found no <ArcBackendTabs>"),
    ]
    caught = 0
    failed = False
    with tempfile.TemporaryDirectory(prefix="arc-typescript-snippets-self-test-") as temporary:
        base = Path(temporary)
        for index, (name, files, pages, expected) in enumerate(contract_cases):
            root = base / f"case-{index}" / "client-snippets"
            root.mkdir(parents=True)
            plant(root, files)
            arc = base / f"case-{index}" / "arc"
            arc.mkdir()
            (arc / "page.mdx").write_text(pages, encoding="utf-8")
            problems: list[str] = []
            check_contract(root, inventory, arc, problems)
            text = "\n".join(problems)
            if not expected and problems:
                print(f"FAIL self-test baseline '{name}' reported problems:\n{text}", file=sys.stderr)
                failed = True
            elif expected and expected not in text:
                print(f"FAIL self-test did not catch {name}; expected '{expected}', got:\n{text or '(nothing)'}",
                      file=sys.stderr)
                failed = True
            elif expected:
                caught += 1

        compile_root = base / "compile" / "client-snippets"
        compile_root.mkdir(parents=True)
        compile_files = {"self-test/clean": VALID_COMMAND,
                         **{snippet_id: content for snippet_id, (content, _) in PLANTED_COMPILE_FAILURES.items()}}
        plant(compile_root, compile_files)
        compile_inventory: dict[str, Context | None] = {snippet_id: MODULE for snippet_id in compile_files}
        problems, compiled, _ = validate(compile_root, compile_inventory, None, FIXTURES)
        reported = {problem.split(" does not compile", 1)[0]: problem for problem in problems
                    if " does not compile" in problem}
        unexpected = [problem for problem in problems if " does not compile" not in problem]
        if unexpected or "self-test/clean" in reported or "fixtures" in reported:
            print("FAIL self-test compile baseline reported problems:\n" + "\n".join(problems), file=sys.stderr)
            failed = True
        for snippet_id, (_, diagnostic) in PLANTED_COMPILE_FAILURES.items():
            if f"error {diagnostic}:" in reported.get(snippet_id, ""):
                caught += 1
            else:
                print(f"FAIL self-test did not catch the planted compile failure {snippet_id} ({diagnostic}):\n"
                      f"{reported.get(snippet_id, '(not reported)')}", file=sys.stderr)
                failed = True
        if compiled != len(compile_files):
            print(f"FAIL self-test compiled {compiled} of {len(compile_files)} planted snippets", file=sys.stderr)
            failed = True

    planted = len(contract_cases) - 1 + len(PLANTED_COMPILE_FAILURES)
    if failed:
        print(f"Self-test failed: caught {caught} of {planted} planted violations.", file=sys.stderr)
        return EXIT_DEFECTS
    print(f"Self-test passed: caught {caught} of {planted} planted violations; both clean baselines passed.")
    return EXIT_CLEAN


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--self-test", action="store_true", help="plant violations and require every one to be caught")
    parser.add_argument("--arc-documentation", type=Path, default=None,
                        help="the shared Arc Documentation folder (default: ../Arc/Documentation when present)")
    parser.add_argument("--keep", action="store_true", help="keep the generated project and print its folder")
    arguments = parser.parse_args()
    try:
        return self_test() if arguments.self_test else run(arguments)
    except Blocked as error:
        print(f"BLOCKED: could not validate the TypeScript snippets: {error}", file=sys.stderr)
        return EXIT_BLOCKED


if __name__ == "__main__":
    sys.exit(main())
