// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ESLintUtils } from '@typescript-eslint/utils';
import { decorated } from './syntax.js';

/** Discovery needs exported declarations, not file-local artifacts. */
export const unexportedArtifact = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Export discoverable Arc artifacts' }, messages: { hidden: 'Export this Arc artifact so discovery can find it.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { ClassDeclaration(node) {
            if (!['command', 'readModel', 'validator'].some(name => decorated(node, name))) return;
            if (node.parent.type !== 'ExportNamedDeclaration' && node.parent.type !== 'ExportDefaultDeclaration') {
                // Re-exports and exports at the end of the same file are valid too.
                if (!node.id || !context.sourceCode.ast.body.some(statement => statement.type === 'ExportNamedDeclaration' &&
                    statement.specifiers.some(specifier => specifier.local.type === 'Identifier' && specifier.local.name === node.id?.name))) {
                    context.report({ node: node.id ?? node, messageId: 'hidden' });
                }
            }
        } };
    }
});
