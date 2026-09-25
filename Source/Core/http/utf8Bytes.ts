// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
const encoder = new TextEncoder();
/** Count UTF-8 bytes using Web APIs on both Fetch and Node hosts. */
export function utf8Bytes(value: string): number { return encoder.encode(value).byteLength; }
