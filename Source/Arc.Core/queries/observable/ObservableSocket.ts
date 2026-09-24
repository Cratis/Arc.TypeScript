// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { HubTransport } from './HubTransport.js';

/** Host-neutral duplex observable transport; public declarations never depend on ws types. */
export interface ObservableSocket extends HubTransport, AsyncIterable<string> {}
