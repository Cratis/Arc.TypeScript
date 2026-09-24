// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Return several response values without conflating an ordinary object with an Arc control outcome. */
export function tuple<const Values extends readonly unknown[]>(...values: Values): Values { return values; }
