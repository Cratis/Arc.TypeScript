// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
export const runtimePost = (url: string, value: unknown, headers: Record<string, string> = {}) =>
    new Request('http://localhost' + url, { method: 'POST', headers, body: JSON.stringify(value) });
