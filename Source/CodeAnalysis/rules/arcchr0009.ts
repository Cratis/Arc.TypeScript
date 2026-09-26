// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createRequire } from 'node:module';
import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from '@typescript-eslint/utils';
import * as ts from 'typescript';
import { decorated, imported } from './syntax.js';

// These names are already withheld by runChronicleCommand; report only the remaining .NET words.
const runtimeMasked = /password|secret|token|credential|apiKey/i;
const sensitive = new Set(['passphrase', 'accesskey', 'privatekey', 'pin', 'otp', 'cvv', 'cvc', 'securitycode', 'authorizationheader']);
const nonSecretTypes = new Set(['Date', 'Guid', 'DateOnly', 'TimeOnly', 'TimeSpan']);

function readsAsUnmaskedSecret(name: string): boolean {
    if (runtimeMasked.test(name)) return false;
    const words = name.match(/[A-Z]+(?=[A-Z][a-z]|[^a-zA-Z]|$)|[A-Z]?[a-z]+|[0-9]+/g)?.map(word => word.toLowerCase()) ?? [];
    return words.some((word, index) => sensitive.has(word) || index + 1 < words.length && sensitive.has(word + words[index + 1]));
}

function nonSecretType(annotation?: TSESTree.TSTypeAnnotation): boolean {
    const type = annotation?.typeAnnotation;
    return type?.type === AST_NODE_TYPES.TSNumberKeyword || type?.type === AST_NODE_TYPES.TSBooleanKeyword ||
        type?.type === AST_NODE_TYPES.TSTypeReference && type.typeName.type === AST_NODE_TYPES.Identifier &&
        nonSecretTypes.has(type.typeName.name);
}

function chronicleAvailable(filename: string): boolean {
    try {
        createRequire(filename).resolve('@cratis/arc.chronicle');
        return true;
    } catch (error) {
        if (!(error instanceof Error) || !('code' in error)) throw error;
        if (error.code === 'MODULE_NOT_FOUND') return false;
        // Import-only packages have no require export; resolve their TypeScript import instead.
        if (error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') return !!ts.resolveModuleName('@cratis/arc.chronicle', filename,
            { module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler }, ts.sys).resolvedModule;
        throw error;
    }
}

/** Find secret-looking command fields that Chronicle does not already mask from causation. */
export function createArcchr0009(resolveChronicle: (filename: string) => boolean = chronicleAvailable) {
    return ESLintUtils.RuleCreator.withoutDocs({
        meta: { type: 'problem', docs: { description: 'Mark secret-looking command fields as not audited' },
            messages: { secret: "Command '{{command}}' carries '{{property}}', whose name reads as a secret, and its value will be written to the causation of every event the command appends. Mark it [NotAudited], or [PII] if it is personal data." }, schema: [] },
        defaultOptions: [],
        create(context) {
            // Rule creation happens once per linted file; resolve only once, not for each class or field.
            const available = resolveChronicle(context.physicalFilename);
            const marked = (node: { decorators?: TSESTree.Decorator[] }): boolean => node.decorators?.some(decorator => {
                const expression = decorator.expression.type === AST_NODE_TYPES.CallExpression ? decorator.expression.callee : decorator.expression;
                return imported(context, expression, '@cratis/arc.chronicle', 'notAudited') ||
                    imported(context, expression, '@cratis/chronicle/compliance', 'pii') ||
                    imported(context, expression, '@cratis/chronicle', 'pii');
            }) ?? false;
            const report = (name: TSESTree.Identifier, command: string) => {
                if (readsAsUnmaskedSecret(name.name)) context.report({ node: name, messageId: 'secret',
                    data: { command, property: name.name } });
            };
            return { ClassDeclaration(node) {
                if (!available || !node.id || !decorated(context, node, 'command') || marked(node)) return;
                for (const member of node.body.body) {
                    if (member.type === AST_NODE_TYPES.PropertyDefinition) {
                        if (member.static || member.key.type !== AST_NODE_TYPES.Identifier || marked(member) ||
                            nonSecretType(member.typeAnnotation) ||
                            member.value?.type === AST_NODE_TYPES.Literal && typeof member.value.value !== 'string') continue;
                        report(member.key, node.id.name);
                    } else if (member.type === AST_NODE_TYPES.MethodDefinition && member.kind === 'constructor') {
                        for (const parameter of member.value.params) {
                            if (parameter.type !== AST_NODE_TYPES.TSParameterProperty || marked(parameter)) continue;
                            const property = parameter.parameter.type === AST_NODE_TYPES.AssignmentPattern ? parameter.parameter.left : parameter.parameter;
                            if (property.type !== AST_NODE_TYPES.Identifier || nonSecretType(property.typeAnnotation)) continue;
                            report(property, node.id.name);
                        }
                    }
                }
            } };
        }
    });
}

export const arcchr0009 = createArcchr0009();
