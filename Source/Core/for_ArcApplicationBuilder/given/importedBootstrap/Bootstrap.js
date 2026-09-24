// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { URL } from 'node:url';
import { ArcApplication } from '../../../index.js';
const builder = ArcApplication.createBuilder();
export const outcome = await builder.discover(new URL('./', import.meta.url)).then(
    () => 'unexpected discovery', error => error.message
);
