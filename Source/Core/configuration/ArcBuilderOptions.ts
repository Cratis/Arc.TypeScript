// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServerOptions } from '../ArcServerOptions.js';

/** Node builder options; disable config or select a file/environment without affecting the Fetch dispatcher. */
export type ArcBuilderOptions = ArcServerOptions & {
    configuration?: false | { file?: string; env?: NodeJS.ProcessEnv };
};
