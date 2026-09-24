// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BadRequest } from '../../binding.js';
import type { ExecutionContext } from '../../ExecutionContext.js';
import type { QueryResult } from '../../QueryResult.js';
import { queryResult, status } from '../../results.js';
import type { ObservableQuerySession } from './ObservableQuerySession.js';

/** Only query routes consume these reserved parameters. Maximum wait bounds retained subscriptions. */
export function snapshotOptions(url: URL): { wait: boolean; timeoutMs: number } {
    const values = new Map<string, string>();
    for (const [name, value] of url.searchParams) {
        const key = name.toLowerCase();
        if (key !== 'waitforfirstresult' && key !== 'waitforfirstresulttimeout') continue;
        if (values.has(key)) throw new BadRequest();
        values.set(key, value);
    }
    const wait = values.get('waitforfirstresult');
    if (wait !== undefined && wait !== 'true' && wait !== 'false') throw new BadRequest();
    const seconds = values.get('waitforfirstresulttimeout');
    const timeout = seconds === undefined ? 30 : Number(seconds);
    if (seconds !== undefined && (!/^(?:\d+)(?:\.\d+)?$/.test(seconds) || !Number.isFinite(timeout) || timeout <= 0 || timeout > 120))
        throw new BadRequest();
    return { wait: wait === 'true', timeoutMs: timeout * 1000 };
}

/** Resolve one snapshot, disposing subscriptions on completion and timeout. */
export async function snapshot(session: ObservableQuerySession, context: ExecutionContext, wait: boolean, timeoutMs: number):
    Promise<{ result: QueryResult; code: number }> {
    if (session.rejection) return { result: session.rejection, code: status(session.rejection) };
    const current = await session.current();
    if (current) return { result: current, code: status(current) };
    if (!wait) return { result: queryResult(context, { isReady: false }), code: 202 };
    const iterator = session.results();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const first = await Promise.race([
            iterator.next().then(value => ({ kind: 'emission' as const, value })),
            new Promise<{ kind: 'timeout' }>(resolve => { timer = setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs); })
        ]);
        if (first.kind === 'timeout') {
            await session.close();
            return { result: queryResult(context, { exceptionMessages: [`Timed out waiting ${timeoutMs / 1000} seconds for the first observable query result.`] }), code: 408 };
        }
        if (first.value.done) return { result: queryResult(context, {
            exceptionMessages: ['Observable query completed before producing its first result.']
        }), code: 500 };
        return { result: first.value.value, code: status(first.value.value) };
    } finally {
        if (timer) clearTimeout(timer);
        await session.close();
    }
}
