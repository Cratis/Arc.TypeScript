// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { renderGeneratedMetadata } from '../../renderGeneratedMetadata.js';

const root = resolve(import.meta.dirname, '../../for_commandResponseType/given');

describe('when rendering outcome responses with rejection and response', () => {
    let metadata: string;
    beforeEach(() => {
        metadata = renderGeneratedMetadata(
            resolve(root, 'tsconfig.json'), resolve(root, 'Features'), resolve(root, 'generatedMetadata.ts'));
    });
    const entry = (name: string) => metadata.split('\n').find(line => line.includes(`\\"name\\":\\"${name}\\"`))!;

    it('should describe a rejection as a void client response with no validated value', () => {
        entry('Rejection').should.contain(
            "handleResult: { cardinality: 'void', nullable: false }, handleValueResult: { cardinality: 'void', nullable: true }");
    });

    it('should describe an event or rejection as a void client response while retaining the raw value shape', () => {
        entry('EventOrRejection').should.contain(
            "handleResult: { cardinality: 'void', nullable: false }, handleValueResult: { cardinality: 'one'");
    });

    it('should describe a tuple response and retain the raw tuple shape', () => {
        entry('TupleWithRejection').should.contain(
            "handleResult: { cardinality: 'one', nullable: false, element: String }, handleValueResult: { cardinality: 'one'");
    });

    it('should describe a wrapped response and omit its outcome from raw value validation', () => {
        entry('WrappedResponse').should.contain(
            "handleResult: { cardinality: 'one', nullable: false, element: String }, " +
            "handleValueResult: { cardinality: 'void', nullable: true }");
    });

    it('should describe a plain array alongside rejection as a many-valued handle', () => {
        entry('PlainArrayOrRejection').should.contain("handleValueResult: { cardinality: 'many', nullable: false }");
    });

    it('should describe an async plain array alongside rejection as a many-valued handle', () => {
        entry('AsyncPlainArrayOrRejection').should.contain("handleValueResult: { cardinality: 'many', nullable: false }");
    });

    it('should describe an event array alongside rejection as a many-valued handle', () => {
        entry('EventArrayOrRejection').should.contain("handleValueResult: { cardinality: 'many', nullable: false }");
    });
});
