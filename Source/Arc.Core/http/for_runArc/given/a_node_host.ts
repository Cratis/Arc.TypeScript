// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { request as httpRequest, type IncomingHttpHeaders, type Server } from 'node:http';
import { request as httpsRequest } from 'node:https';

export async function exchange(port: number, path: string, method = 'GET', headers: Record<string, string> = {}, payload?: string, secure = false): Promise<{
    status: number; headers: IncomingHttpHeaders; body: string
}> {
    return new Promise((resolve, reject) => {
        const request = (secure ? httpsRequest : httpRequest)({ host: '127.0.0.1', port, path, method, headers, rejectUnauthorized: false }, response => {
            const chunks: Buffer[] = [];
            response.on('data', chunk => chunks.push(Buffer.from(chunk)));
            response.on('end', () => resolve({ status: response.statusCode!, headers: response.headers, body: Buffer.concat(chunks).toString() }));
        });
        request.on('error', reject);
        request.end(payload);
    });
}

export function portOf(listener: Server): number {
    const address = listener.address();
    if (!address || typeof address === 'string') throw Error('No port');
    return address.port;
}

export async function eventually(predicate: () => boolean): Promise<void> {
    const deadline = Date.now() + 2000;
    while (!predicate()) {
        if (Date.now() > deadline) throw Error('Condition did not become true');
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}
