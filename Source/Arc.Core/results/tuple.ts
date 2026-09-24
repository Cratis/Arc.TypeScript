// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcTuple } from './ArcTuple.js';

/** Return branded response values without conflating them with a plain array. */
export function tuple<const Values extends readonly unknown[]>(...values: Values): ArcTuple<Values> { return new ArcTuple(values); }
