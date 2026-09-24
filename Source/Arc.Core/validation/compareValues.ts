// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DateOnly, TimeOnly, TimeSpan } from '@cratis/fundamentals';

/** @internal Compare only numbers and matching temporal value types. */
export function compareValues(left: unknown, right: unknown): number | undefined {
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    if (left instanceof Date && right instanceof Date) return (left as Date).getTime() - (right as Date).getTime();
    if (left instanceof DateOnly && right instanceof DateOnly || left instanceof TimeOnly && right instanceof TimeOnly)
        return (left as DateOnly | TimeOnly).toString().localeCompare((right as DateOnly | TimeOnly).toString());
    if (left instanceof TimeSpan && right instanceof TimeSpan) return (left as TimeSpan).ticks - (right as TimeSpan).ticks;
    return undefined;
}
