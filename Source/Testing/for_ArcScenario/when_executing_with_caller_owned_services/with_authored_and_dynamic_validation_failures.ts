// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterAll, beforeEach, describe, it, should } from 'vitest';
import { currentServices } from '../../../Arc.Core/dependencyInjection/ServiceScope.js';
import { given } from '../../given.js';
import { shouldHaveRuleFailure } from '../../shouldHaveRuleFailure.js';
import { an_owned_service_scenario } from '../given/an_owned_service_scenario.js';

should();
describe('when executing with caller owned services with authored and dynamic validation failures', given(an_owned_service_scenario, context => {
    let ruleVerified: boolean; let dynamicReason: string | undefined; let dynamicNotRule: boolean;
    let queryData: unknown; let ambientFailure: unknown;
    beforeEach(async () => {
        const rule = await context.scenario.executeCommand('Rule', {}, { correlationId: 'test-id' });
        shouldHaveRuleFailure(rule, { reason: 'rule', member: 'name', severity: 3, correlationId: 'test-id' });
        ruleVerified = true;
        const dependency = await context.scenario.executeCommand('Dynamic', {});
        dynamicReason = dependency.validationResults[0]?.reason;
        try { shouldHaveRuleFailure(dependency, { reason: 'rule' }); dynamicNotRule = false; }
        catch { dynamicNotRule = true; }
        queryData = (await context.scenario.performQuery('Value', {})).data;
        try { currentServices(); } catch (error) { ambientFailure = error; }
    });
    afterAll(async () => { await context.scenario.dispose(); });
    it('should identify authored rules separately from dynamic dependency failures', () => {
        ruleVerified.should.equal(true);
        (dynamicReason as string).should.equal('dependencyUnavailable');
        dynamicNotRule.should.equal(true);
    });
    it('should preserve caller owned instances and clear ambient service scope', () => {
        (queryData as boolean).should.equal(true);
        context.disposed.should.equal(false);
        (ambientFailure as Error).message.should.match(/No live/);
    });
}));
