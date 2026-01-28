const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function fetcher(url: string) {
    const res = await fetch(`${API_BASE}${url}`);
    if (!res.ok) throw new Error('Failed to fetch data');
    return res.json();
}

export async function poster(url: string, data: any) {
    const res = await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to post data');
    return res.json();
}

export async function patcher(url: string, data: any) {
    const res = await fetch(`${API_BASE}${url}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to patch data');
    return res.json();
}
