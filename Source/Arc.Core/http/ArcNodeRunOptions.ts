// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServerOptions as HttpsOptions } from 'node:https';
import type { ArcNodeOptions } from './ArcNodeOptions.js';

/** Listener configuration; ArcServer's lifetime remains caller-owned. */
export interface ArcNodeRunOptions extends ArcNodeOptions {
    port?: number;
    host?: string;
    https?: HttpsOptions;
}
