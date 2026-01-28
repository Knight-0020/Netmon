import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE || 'http://api:8000';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function handler(req: NextRequest, context: { params: { path?: string[] } }) {
    const path = (context.params.path || []).join('/');
    const search = req.nextUrl.search;
    const target = `${API_BASE}/${path}${search}`;

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

    const res = await fetch(target, { ...init, cache: 'no-store' });
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
