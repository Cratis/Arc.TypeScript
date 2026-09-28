#!/usr/bin/env python3
# Copyright (c) Cratis. All rights reserved.
# Licensed under the MIT license. See LICENSE file in the project root for full license information.

"""Exercise proxy generation, Node discovery and Chronicle registration on the published State View tabs."""

import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("client_snippets", Path(__file__).with_name("validate-client-snippets.py"))
validator = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = validator
spec.loader.exec_module(validator)

IDS = (
    "scenarios/vertical-slices/state-view/author-list",
    "scenarios/vertical-slices/state-view/fluent-projection",
)

# The script is run outside the discovered folder: NodeArcApplicationBuilder refuses to
# discover its own bootstrap. Both source analysis and runtime discovery use actual output
# from the published fences, not hand-maintained copies of their classes.
CHECK = """
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyzeSource } from '__ROOT__/Source/Tools/ProxyGenerator/dist/analyzeSource.js';
import { renderSource } from '__ROOT__/Source/Tools/ProxyGenerator/dist/renderSource.js';
import { NodeArcApplicationBuilder } from '__ROOT__/Source/Core/dist/NodeArcApplicationBuilder.js';
import { ChronicleArtifacts } from '__ROOT__/Source/Chronicle/dist/ChronicleArtifacts.js';
import { ProjectionDefinitionCompiler } from '__ROOT__/node_modules/@cratis/chronicle/dist/projections/ProjectionDefinitionCompiler.js';

const root = process.cwd();
const cases = ['scenarios_vertical_slices_state_view_author_list', 'scenarios_vertical_slices_state_view_fluent_projection'];
const [list, fluent] = await Promise.all(cases.map(name => import(pathToFileURL(join(root, 'dist/snippets', name, 'snippet.js')).href)));
const [listName, fluentName] = cases;
const analysis = analyzeSource(join(root, 'tsconfig.json'), join(root, 'snippets', listName));
assert.ok(analysis.operations.some(operation => operation.name === 'allAuthors' && operation.owner === 'Author'), 'AllAuthors query missing from source analysis');
const proxies = renderSource(analysis);
assert.ok([...proxies.keys()].some(name => name.endsWith('AllAuthors.ts')), 'AllAuthors proxy missing');
assert.ok([...proxies.keys()].some(name => name.endsWith('Author.ts')), 'Author proxy missing');

for (const [name, module, expected] of [[listName, list, ['AuthorRegistered', 'Author']],
    [fluentName, fluent, ['AuthorImported', 'Author', 'AuthorProjection']]]) {
    for (const exported of expected) assert.equal(typeof module[exported], 'function', `${name}: ${exported} not exported`);
    const catalog = new ChronicleArtifacts();
    const builder = new NodeArcApplicationBuilder();
    builder.addArtifactObserver(type => catalog.register(type));
    await builder.discover(pathToFileURL(join(root, 'dist/snippets', name)));
    if (name === listName) {
        assert.ok(catalog.eventTypes.includes(module.AuthorRegistered), 'Node discovery missed AuthorRegistered');
        assert.ok(catalog.readModels.includes(module.Author), 'Node discovery missed Author');
    } else {
        assert.ok(catalog.eventTypes.includes(module.AuthorImported), 'Node discovery missed AuthorImported');
        assert.ok(catalog.projections.includes(module.AuthorProjection), 'Node discovery missed AuthorProjection');
        assert.ok(catalog.readModels.includes(module.Author), 'Node discovery missed projection read model');
        const compiled = new ProjectionDefinitionCompiler(catalog, 'test-sink').compile(catalog.projections, []);
        assert.equal(compiled.definitions.length, 1);
        assert.equal(compiled.definitions[0].ReadModel, 'Author');
        assert.equal(compiled.readModels.length, 1);
        assert.equal(compiled.readModels[0].Type.Identifier, 'Author');
        const schema = JSON.parse(compiled.readModels[0].Schema);
        for (const field of ['id', 'firstName', 'lastName'])
            assert.ok(schema.properties?.[field], `Compiled Author read model is missing ${field}: ${JSON.stringify(schema)}`);
    }
}
console.log('PASS State View source proxies, Node discovery and Author projection schema');
"""


# Build outputs this check imports beyond the validator's own toolchain.
DISCOVERY_BUILD_OUTPUTS = (
    ROOT / "Source" / "Tools" / "ProxyGenerator" / "dist" / "analyzeSource.js",
    ROOT / "Source" / "Chronicle" / "dist" / "ChronicleArtifacts.js",
)


def main():
    validator.ensure_toolchain()
    missing = [path.relative_to(ROOT).as_posix() for path in DISCOVERY_BUILD_OUTPUTS if not path.is_file()]
    if missing:
        raise validator.Blocked(f"packages are not built ({', '.join(missing)} missing); run `yarn build`")
    with tempfile.TemporaryDirectory(prefix="arc-state-view-discovery-") as temporary:
        project = Path(temporary)
        snippets = [validator.parse(snippet_id, validator.SNIPPET_ROOT / f"{snippet_id}.md") for snippet_id in IDS]
        validator.write_project(project, snippets, validator.SNIPPETS, validator.FIXTURES)
        config = project / "tsconfig.json"
        settings = json.loads(config.read_text(encoding="utf-8"))
        settings["compilerOptions"].update({"noEmit": False, "outDir": "dist"})
        config.write_text(json.dumps(settings), encoding="utf-8")
        check = project / "check.mjs"
        check.write_text(CHECK.replace("__ROOT__", ROOT.as_posix()), encoding="utf-8")
        for command in ([str(validator.TSC), "-p", str(config), "--pretty", "false"], ["node", str(check)]):
            result = subprocess.run(command, cwd=project, check=False)
            if result.returncode:
                return result.returncode
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except validator.Blocked as error:
        print(f"BLOCKED State View discovery: {error}", file=sys.stderr)
        sys.exit(validator.EXIT_BLOCKED)
    except validator.SnippetError as error:
        print(f"FAIL State View discovery: {error}", file=sys.stderr)
        sys.exit(validator.EXIT_DEFECTS)
