import { NextRequest, NextResponse } from 'next/server';

const ENV_API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function resolveApiBase(req: NextRequest) {
    if (ENV_API_BASE) return ENV_API_BASE;

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const protoHeader = req.headers.get('x-forwarded-proto');
    const proto = protoHeader || req.nextUrl.protocol.replace(':', '') || 'http';

    if (!host) return 'http://localhost:8000';

    const [hostname, port] = host.split(':');
    let apiPort = port;

    if (port === '3000') apiPort = '8000';
    if (port === '9440') apiPort = '9441';

    if (!apiPort) return 'http://localhost:8000';

    return `${proto}://${hostname}:${apiPort}`;
}

async function handler(req: NextRequest, context: { params: { path?: string[] } }) {
    const base = resolveApiBase(req);
    const path = (context.params.path || []).join('/');
    const search = req.nextUrl.search;
    const target = `${base}/${path}${search}`;

    const headers = new Headers(req.headers);
    headers.delete('host');
    headers.delete('content-length');

    const init: RequestInit = {
        method: req.method,
        headers,
        redirect: 'manual',
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        init.body = await req.arrayBuffer();
    }

    const res = await fetch(target, init);
    const resHeaders = new Headers(res.headers);
    resHeaders.delete('content-encoding');
    resHeaders.delete('content-length');

    return new NextResponse(res.body, {
        status: res.status,
        headers: resHeaders,
    });
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
