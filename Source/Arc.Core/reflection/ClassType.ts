// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** A class constructor, including abstract service tokens. */
export type ClassType<T = unknown> = abstract new (...arguments_: never[]) => T;
