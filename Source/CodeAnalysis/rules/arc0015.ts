// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import * as ts from 'typescript';
import { isConcept, isPrimitive } from './conceptTypes.js';
import { typesFor } from './bindingTypes.js';
import { decorated, memberName } from './syntax.js';

/** Incoming primitives converted in a handler bypass concept validation. */
export const arc0015 = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Declare incoming parameters as concepts' }, messages: { concept: 'Declare parameter {{name}} as the concept; converting inside the method skips its validator.' }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { NewExpression(node) {
            const value = node.arguments[0];
            if (value?.type !== AST_NODE_TYPES.Identifier) return;
            let parent: TSESTree.Node | undefined = node.parent;
            while (parent && parent.type !== AST_NODE_TYPES.MethodDefinition) parent = parent.parent;
            if (parent?.type !== AST_NODE_TYPES.MethodDefinition || memberName(parent) !== 'handle' && !decorated(parent, 'query')) return;
            const owner = parent.parent?.parent;
            if (owner?.type !== AST_NODE_TYPES.ClassDeclaration || !decorated(owner, 'command') && !decorated(owner, 'readModel')) return;
            const parameter = parent.value.params.find(item => item.type === AST_NODE_TYPES.Identifier && item.name === value.name);
            if (!parameter) return;
            const { checker, node: tsNode } = typesFor(context);
            const signature = checker.getSignaturesOfType(checker.getTypeAtLocation(tsNode(node.callee)), ts.SignatureKind.Construct)[0];
            if (signature && isConcept(checker, checker.getReturnTypeOfSignature(signature)) && isPrimitive(checker.getTypeAtLocation(tsNode(parameter)))) {
                context.report({ node: parameter, messageId: 'concept', data: { name: value.name } });
            }
        } };
    }
});
