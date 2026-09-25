// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { analyzeSource } from '../../analyzeSource.js';

const root = resolve(import.meta.dirname, '../given');

describe('when selecting a command client response with outcome control branches', () => {
    let analysis: ReturnType<typeof analyzeSource>;
    beforeEach(() => { analysis = analyzeSource(resolve(root, 'tsconfig.json'), resolve(root, 'Features')); });

    it('should omit a rejection', () => {
        analysis.operations.find(item => item.name === 'Rejection')!.result.void.should.equal(true);
    });

    it('should omit a denial', () => {
        analysis.operations.find(item => item.name === 'Denial')!.result.void.should.equal(true);
    });

    it('should omit the rejection alongside an event', () => {
        analysis.operations.find(item => item.name === 'EventOrRejection')!.result.void.should.equal(true);
    });

    it('should omit the rejection alongside an async event', () => {
        analysis.operations.find(item => item.name === 'AsyncEventOrRejection')!.result.void.should.equal(true);
    });

    it('should omit the rejection and event from a tuple with a response', () => {
        analysis.operations.find(item => item.name === 'TupleWithRejection')!.result.text.should.equal('string');
    });

    it('should unwrap a visible response from Outcome', () => {
        analysis.operations.find(item => item.name === 'WrappedResponse')!.result.text.should.equal('string');
    });

    it('should unwrap an async visible response from Outcome', () => {
        analysis.operations.find(item => item.name === 'AsyncWrappedResponse')!.result.text.should.equal('string');
    });

    it('should omit an event wrapped in Outcome', () => {
        analysis.operations.find(item => item.name === 'WrappedEvent')!.result.void.should.equal(true);
    });

    it('should not create client models for handled events', () => {
        analysis.models.map(item => item.name).should.not.include('Registered');
    });
});
