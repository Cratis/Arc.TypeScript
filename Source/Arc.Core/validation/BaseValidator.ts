// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs } from '@cratis/fundamentals';
import { ownMetadata, type WireType } from '../reflection/metadata.js';
import { fieldsFor } from '../reflection/wireSchema.js';
import { capturePath } from './capturePath.js';
import { RuleBuilder } from './RuleBuilder.js';
import type { Rule } from './Rule.js';
import type { Unwrap } from './Unwrap.js';

/** Rule registration shared by command, query, model, and concept validators. */
export class BaseValidator<T> {
    readonly #rules: Rule[] = [];
    readonly #ignored = new Set<string>();
    /** @internal Rules are descriptors for the graph evaluator, not a public extension point. */
    get rules(): readonly Rule[] { return Object.freeze([...this.#rules]); }
    /** @internal Direct concept members whose concept validators are skipped. */
    get ignoredConceptRules(): ReadonlySet<string> { return this.#ignored; }
    /** Select a member and register rules against its unwrapped value. */
    ruleFor<V>(selector: (model: T) => V): RuleBuilder<T, Unwrap<V>> {
        const path = capturePath(selector);
        const target = ownMetadata(this.constructor as WireType).validatorTarget as WireType | undefined;
        if (target) {
            let current: WireType = target;
            for (const [index, part] of path.entries()) {
                if (current.prototype instanceof ConceptAs && part === 'value' && index === path.length - 1) break;
                const field = fieldsFor(current).find(item => item.name === part);
                if (!field || index < path.length - 1 && (field.element || field.type.prototype instanceof ConceptAs))
                    throw new Error(`Invalid validation member: ${path.join('.')}`);
                current = field.type;
            }
        }
        return new RuleBuilder(path, rule => this.#rules.push(rule), (old, replacement) => {
            const index = this.#rules.indexOf(old);
            if (index < 0) throw new Error('Rule is no longer registered');
            this.#rules[index] = replacement;
        }, name => this.#ignored.add(name));
    }
}
