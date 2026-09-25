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

    it('should describe a rejection as a void client response while retaining the raw value shape', () => {
        entry('Rejection').should.contain(
            "handleResult: { cardinality: 'void', nullable: false }, handleValueResult: { cardinality: 'one'");
    });

    it('should describe an event or rejection as a void client response while retaining the raw value shape', () => {
        entry('EventOrRejection').should.contain(
            "handleResult: { cardinality: 'void', nullable: false }, handleValueResult: { cardinality: 'one'");
    });

    it('should describe a tuple response and retain the raw tuple shape', () => {
        entry('TupleWithRejection').should.contain(
            "handleResult: { cardinality: 'one', nullable: false, element: String }, handleValueResult: { cardinality: 'one'");
    });

    it('should describe a wrapped response and retain the raw outcome shape', () => {
        entry('WrappedResponse').should.contain(
            "handleResult: { cardinality: 'one', nullable: false, element: String }, handleValueResult: { cardinality: 'one'");
    });
});
