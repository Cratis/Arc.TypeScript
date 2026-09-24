// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Runtime class of a decorated model-bound Arc artifact. */
export type ClassType<T extends object = object> = abstract new (...arguments_: never[]) => T;
