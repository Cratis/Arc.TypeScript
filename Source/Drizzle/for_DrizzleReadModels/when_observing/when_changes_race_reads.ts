// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_gated_observation, deferred, flush } from './given/a_gated_observation.js';

describe('when a change arrives during the initial observation read', given(a_gated_observation, context => {
    let emissions: number[];
    beforeEach(async () => {
        const first = deferred();
        context.reads = 0;
        emissions = [];
        const observation = context.open(() => context.reads === 1 ? first.promise : Promise.resolve(2));
        const subscription = observation.subscribe(value => emissions.push(value));
        context.notify();
        first.resolve(1);
        await flush();
        subscription.unsubscribe();
    });
    afterEach(() => context.close());
    it('should read once more after the notification', () => { emissions.should.deep.equal([1, 2]); });
    it('should not leave a listener after unsubscribe', () => { context.listeners.should.equal(0); });
}));

describe('when a burst arrives during an in-flight reread', given(a_gated_observation, context => {
    let emissions: number[];
    beforeEach(async () => {
        const second = deferred();
        context.reads = 0;
        emissions = [];
        const observation = context.open(() => context.reads === 2 ? second.promise : Promise.resolve(context.reads));
        const subscription = observation.subscribe(value => emissions.push(value));
        await flush();
        context.notify();
        await flush();
        for (let index = 0; index < 100; index++) context.notify();
        second.resolve(2);
        await flush();
        subscription.unsubscribe();
    });
    afterEach(() => context.close());
    it('should coalesce the burst into one trailing read', () => { context.reads.should.equal(3); });
    it('should emit the final state', () => { emissions.should.deep.equal([1, 2, 3]); });
}));

describe('when a later observation read fails', given(a_gated_observation, context => {
    let reported: unknown;
    let readsAfterAnotherNotification: number;
    const failure = new Error('read failed');
    beforeEach(async () => {
        context.reads = 0;
        reported = undefined;
        context.open(() => context.reads === 1 ? Promise.resolve(1) : Promise.reject(failure))
            .subscribe({ error: error => { reported = error; } });
        await flush();
        context.notify();
        await flush();
        context.notify();
        readsAfterAnotherNotification = context.reads;
    });
    afterEach(() => context.close());
    it('should deliver the original error', () => { (reported === failure).should.equal(true); });
    it('should release the listener without reopening', () => {
        context.listeners.should.equal(0);
        readsAfterAnotherNotification.should.equal(2);
    });
}));

describe('when the initial read fails before adoption', given(a_gated_observation, context => {
    let errors: string[];
    let currentFailed: boolean;
    beforeEach(async () => {
        const first = deferred();
        const observation = context.open(() => first.promise);
        const current = observation.current().then(() => false, () => true);
        first.reject(new Error('database failed'));
        currentFailed = await current;
        errors = [];
        observation.subscribe({ error: error => errors.push((error as Error).message) });
        await flush();
    });
    afterEach(() => context.close());
    it('should reject current', () => { currentFailed.should.equal(true); });
    it('should retain the error for its first subscriber', () => { errors.should.deep.equal(['database failed']); });
}));

describe('when a primed observation closes before adoption', given(a_gated_observation, context => {
    let completed: boolean;
    beforeEach(async () => {
        const observation = context.open(() => Promise.resolve(1));
        await observation.current();
        observation.close();
        completed = false;
        observation.subscribe({ complete: () => { completed = true; } });
    });
    it('should complete the late subscriber', () => { completed.should.equal(true); });
}));

describe('when a primed read fails after closure', given(a_gated_observation, context => {
    let canceled: boolean;
    beforeEach(async () => {
        const first = deferred();
        const observation = context.open(() => first.promise);
        const current = observation.current().then(() => false, () => true);
        observation.close();
        first.reject(new Error('late'));
        canceled = await current;
    });
    it('should reject the pending current rather than deliver the late failure', () => { canceled.should.equal(true); });
}));
