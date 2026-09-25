// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function correlation(value: string | null): string {
    return value && uuid.test(value) && value.toLowerCase() !== '00000000-0000-0000-0000-000000000000' ? value.toLowerCase() : crypto.randomUUID();
}
