// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ObserveSummary } from './ObserveSummary.proxy';

/** Items and notes joined into one live result with a shared change stream. */
export function SummaryView() {
    const [result] = ObserveSummary.use();
    return <p>{result.data ? `${result.data.itemCount} items, ${result.data.noteCount} notes. Latest note: ${result.data.latestNote || '—'}` : 'Waiting for MongoDB…'}</p>;
}
