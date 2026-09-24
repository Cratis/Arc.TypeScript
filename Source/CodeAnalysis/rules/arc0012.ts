// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import { decorated } from './syntax.js';

const builtIns = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'AggregateError']);

/** Prefer domain errors for failures originating in Arc artifacts. */
export const arc0012 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Do not throw built-in errors from Arc artifacts' }, messages: { builtIn: 'Throw a domain-named error instead of {{name}} from an Arc artifact.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        let artifact = 0;
        const isArtifact = (node: TSESTree.ClassDeclaration): boolean => decorated(node, 'command') || decorated(node, 'validator') || decorated(node, 'readModel');
        return {
            ClassDeclaration(node) { if (isArtifact(node)) artifact++; },
            'ClassDeclaration:exit'(node) { if (isArtifact(node)) artifact--; },
            ThrowStatement(node) {
                if (!artifact || node.argument?.type !== AST_NODE_TYPES.NewExpression || node.argument.callee.type !== AST_NODE_TYPES.Identifier) return;
                if (builtIns.has(node.argument.callee.name)) context.report({ node, messageId: 'builtIn', data: { name: node.argument.callee.name } });
            }
        };
    }
});
