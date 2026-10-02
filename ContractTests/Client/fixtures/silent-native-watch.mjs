// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';

// Model a successfully registered native watcher that never reports a filesystem change.
fs.watch = () => Object.assign(new EventEmitter(), { close() {} });
syncBuiltinESMExports();
