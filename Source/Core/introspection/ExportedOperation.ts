// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../ArcServer.js';

/** A command or query registered on the server that can be exported to a client manifest. */
export type ExportedOperation = ArcServer['commands'][number] | ArcServer['queries'][number];
