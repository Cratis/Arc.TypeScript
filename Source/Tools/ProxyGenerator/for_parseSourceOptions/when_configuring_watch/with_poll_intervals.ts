// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { parseSourceOptions } from '../../parseSourceOptions.js';
import { watchPollInterval } from '../../watchPollInterval.js';

const required = ['--project', '/tsconfig.json', '--artifacts', '/src', '--output', '/out', '--watch'];
describe('when configuring watch polling intervals', () => {
    it('should accept a separated interval value', () => {
        parseSourceOptions([...required, '--watch-poll-interval', '750'], '').configuration.watchPollInterval!.should.equal(750);
    });
    it('should accept zero to disable polling', () => {
        parseSourceOptions([...required, '--watch-poll-interval=0'], '').configuration.watchPollInterval!.should.equal(0);
    });
    it('should default to one second on macOS', () => watchPollInterval(undefined, 'darwin').should.equal(1000));
    it('should default to five seconds on other platforms', () => watchPollInterval(undefined, 'linux').should.equal(5000));
    for (const value of ['-1', '1.5', 'NaN', 'Infinity', ' ', '2147483648']) {
        it(`should reject an invalid CLI interval (${value})`, () => {
            (() => parseSourceOptions([...required, `--watch-poll-interval=${value}`], '')).should.throw();
        });
    }
    for (const value of [-1, 0.5, NaN, Infinity, 2_147_483_648]) {
        it(`should reject an invalid programmatic interval (${value})`, () => {
            (() => watchPollInterval(value)).should.throw();
        });
    }
    it('should reject a missing interval', () => {
        (() => parseSourceOptions([...required, '--watch-poll-interval'], '')).should.throw('Missing value');
    });
    it('should reject an interval without watch mode', () => {
        (() => parseSourceOptions([...required.slice(0, -1), '--watch-poll-interval=0'], '')).should.throw('requires --watch');
    });
    it('should reject duplicate intervals', () => {
        (() => parseSourceOptions([...required, '--watch-poll-interval=0', '--watch-poll-interval=1'], '')).should.throw('duplicate');
    });
});
