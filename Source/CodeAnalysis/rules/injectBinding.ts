// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AST_NODE_TYPES, ESLintUtils } from '@typescript-eslint/utils';
import { typesFor, tokenMatches } from './bindingTypes.js';
import { decoration, imported, memberName, method } from './syntax.js';

/** Check class-valued @inject tokens with the TypeScript checker. */
export const injectBinding = ESLintUtils.RuleCreator.withoutDocs({
    meta: { type: 'problem', docs: { description: 'Align @inject tokens with handle parameters' }, messages: {
        count: '@inject on {{name}} must match handle parameters (allowing one provided value only with provide()).',
        type: '@inject token {{token}} cannot produce parameter {{parameter}}.'
    }, schema: [] },
    defaultOptions: [],
    create(context) {
        return { MethodDefinition(node) {
            if (memberName(node) !== 'handle') return;
            const call = decoration(context, node, 'inject');
            if (!call) return;
            const owner = node.parent?.parent;
            const hasProvider = owner?.type === AST_NODE_TYPES.ClassDeclaration && !!method(owner, 'provide');
            const name = owner?.type === AST_NODE_TYPES.ClassDeclaration ? owner.id?.name ?? '<anonymous>' : '<anonymous>';
            const firstOptional = node.value.params.findIndex(parameter => parameter.type === AST_NODE_TYPES.AssignmentPattern || parameter.type === AST_NODE_TYPES.RestElement);
            const count = firstOptional < 0 ? node.value.params.length : firstOptional;
            const typedPreparation = call.arguments.some(token => token.type === AST_NODE_TYPES.CallExpression &&
                imported(context, token.callee, '@cratis/arc.core', 'provided'));
            const offset = count - call.arguments.length;
            if (offset !== 0 && !(offset === 1 && hasProvider && !typedPreparation)) {
                context.report({ node: call, messageId: 'count', data: { name } }); return;
            }
            const types = typesFor(context);
            if (!types) return;
            const { checker, node: tsNode } = types;
            call.arguments.forEach((token, index) => {
                if (token.type === AST_NODE_TYPES.SpreadElement) return;
                const parameter = node.value.params[index + offset];
                // Legacy emitted metadata erases generic arguments. A token for the generic
                // constructor cannot prove the parameter binding is wrong.
                if (parameter?.type === AST_NODE_TYPES.Identifier && parameter.typeAnnotation?.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
                    parameter.typeAnnotation.typeAnnotation.typeArguments?.params.length && token.type === AST_NODE_TYPES.Identifier &&
                    parameter.typeAnnotation.typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier &&
                    parameter.typeAnnotation.typeAnnotation.typeName.name === token.name) return;
                if (parameter && !tokenMatches(checker, tsNode(token), tsNode(parameter))) context.report({ node: token, messageId: 'type',
                    data: { token: context.sourceCode.getText(token), parameter: context.sourceCode.getText(parameter) } });
            });
        } };
    }
});
