// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderIndirectConceptFields } from './given/indirect_concept_fields.js';

const record = 'https://github.com/Cratis/Arc.TypeScript/blob/main/decisions/0004-defer-generated-proxy-removals-to-the-next-major-release.md';
const comment = (value: string, kind = 'class'): string =>
    `/** @deprecated Generated proxies type this concept as its underlying ${value}; this empty ${kind} is no longer referenced and will be removed in the next major release (${record}). */\n`;

describe('when resolving concept subclasses with the scalar option and deprecated classes', () => {
    let output: ReadonlyMap<string, string>;
    let interfaces: ReadonlyMap<string, string>;
    beforeEach(() => {
        output = renderIndirectConceptFields(true);
        interfaces = renderIndirectConceptFields(true, true);
    });
    it('should name the underlying value of an indirect concept', () => {
        output.get('DerivedId.ts')!.should.contain(`${comment('Guid')}export class DerivedId {\n}`);
        output.get('DerivedDay.ts')!.should.contain(`${comment('DateOnly')}export class DerivedDay {\n}`);
    });
    it('should deprecate every class of a multi-level chain', () => {
        output.get('MiddleName.ts')!.should.contain(`${comment('string')}export class MiddleName {\n}`);
        output.get('DeepName.ts')!.should.contain(`${comment('string')}export class DeepName extends MiddleName {\n}`);
    });
    it('should use the neutral message for a generic class shared by several instantiations', () => {
        output.get('Wrapper.ts')!.should.contain(`${comment('value')}export class Wrapper {\n}`);
        output.get('TextWrapper.ts')!.should.contain(`${comment('string')}export class TextWrapper extends Wrapper {\n}`);
        output.get('NumberWrapper.ts')!.should.contain(`${comment('number')}export class NumberWrapper extends Wrapper {\n}`);
    });
    it('should not quote value text that would end the comment', () => {
        output.get('DerivedLiteral.ts')!.should.contain(`${comment('value')}export class DerivedLiteral {\n}`);
        output.get('DerivedLiteral.ts')!.should.not.contain('"*/"');
    });
    it('should call an emitted interface an interface', () => {
        interfaces.get('DerivedId.ts')!.should.contain(`${comment('Guid', 'interface')}export interface DerivedId {`);
        interfaces.get('Wrapper.ts')!.should.contain(`${comment('value', 'interface')}export interface Wrapper {`);
    });
    it('should link the decision record instead of an issue', () => [...output.values()].every(content => !content.includes('/issues/')).should.be.true);
});
