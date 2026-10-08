// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { renderConceptSubclasses } from './given/concept_subclasses.js';

const record = 'https://github.com/Cratis/Arc.TypeScript/blob/main/decisions/0004-defer-generated-proxy-removals-to-the-next-major-release.md';
const deprecation = `/** @deprecated Generated proxies type this concept as its underlying string; this empty class is no longer referenced and will be removed in the next major release (${record}). */\n`;
const neutral = `/** @deprecated Generated proxies type this concept as its underlying value; this empty class is no longer referenced and will be removed in the next major release (${record}). */\n`;

describe('when resolving concept subclasses with their former classes', () => {
    let output: ReadonlyMap<string, string>;
    let interfaces: ReadonlyMap<string, string>;
    beforeEach(() => {
        output = renderConceptSubclasses();
        interfaces = renderConceptSubclasses({ emitInterfaces: true });
    });
    it('should still emit the deprecated indirect concept class', () => output.get('DerivedName.ts')!.should.contain(`${deprecation}export class DerivedName {\n}`));
    it('should still emit the deprecated generic intermediate class', () =>
        output.get('GenericIntermediate.ts')!.should.contain(`${neutral}export class GenericIntermediate {\n}`));
    it('should still emit the deprecated generic concept class with its base', () => {
        output.get('GenericName.ts')!.should.contain("import { GenericIntermediate } from './GenericIntermediate';");
        output.get('GenericName.ts')!.should.contain(`${deprecation}export class GenericName extends GenericIntermediate {\n}`);
    });
    it('should deprecate the emitted interfaces too', () =>
        interfaces.get('DerivedName.ts')!.should.contain(`${deprecation.replace('empty class', 'empty interface')}export interface DerivedName {`));
    it('should link the decision record instead of an issue', () => output.get('DerivedName.ts')!.should.not.contain('/issues/'));
    it('should not emit classes for direct concepts', () => output.has('Name.ts').should.be.false);
});
