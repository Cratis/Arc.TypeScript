// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, currentServices, inject } from '@cratis/arc.core';
import { CommandScenario } from '../../index.js';

class Probe { constructor(readonly number: number) {} }
@command()
class UseProbe {
    @inject(Probe)
    async handle(probe: Probe): Promise<number[]> {
        const another = await currentServices().resolve(Probe);
        return [probe.number, another.number];
    }
}

describe('when resolving services through a command scenario', () => {
    let scenario: CommandScenario<UseProbe>;
    afterEach(async () => { await scenario.dispose(); });
    it('should reuse a scoped service within a call and recreate it on the next call', async () => {
        scenario = CommandScenario.for(UseProbe);
        let created = 0;
        scenario.services.addScoped(Probe, () => new Probe(++created));
        ((await scenario.execute(new UseProbe())).response as number[]).should.deep.equal([1, 1]);
        ((await scenario.execute(new UseProbe())).response as number[]).should.deep.equal([2, 2]);
    });
    it('should create transient services on each resolution', async () => {
        scenario = CommandScenario.for(UseProbe);
        let created = 0;
        scenario.services.addTransient(Probe, () => new Probe(++created));
        const values = (await scenario.execute(new UseProbe())).response as number[];
        (values[1]! - values[0]!).should.equal(1);
    });
});
