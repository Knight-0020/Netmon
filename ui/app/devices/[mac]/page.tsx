"use client";

import useSWR, { mutate } from 'swr';
import { fetcher, patcher } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Save } from 'lucide-react';

export default function DeviceDetailPage({ params }: { params: { mac: string } }) {
    const mac = decodeURIComponent(params.mac);
    const encodedMac = encodeURIComponent(mac);
    const { data: device, error: deviceError } = useSWR(`/devices/${encodedMac}`, fetcher, { refreshInterval: 10000 });
    const { data: events, error: eventsError } = useSWR('/events?limit=200', fetcher, { refreshInterval: 10000 });

    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [saving, setSaving] = useState(false);

    const deviceTitle = (device: any) => {
        const name = device.name?.trim();
        if (name) return name;
        const host = device.hostname?.trim();
        if (host) return host;
        const vendor = device.vendor?.trim();
        return vendor || 'Unknown Device';
    };

    useEffect(() => {
        if (!device) return;
        setName(device.name || '');
        setNotes(device.notes || '');
        setTagsInput((device.tags || []).join(', '));
    }, [device]);

    const deviceEvents = useMemo(() => {
        if (!events) return [];
        return events.filter((e: any) => e.device_mac === mac);
    }, [events, mac]);

    const save = async () => {
        try {
            setSaving(true);
            const tags = tagsInput
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);
            await patcher(`/devices/${encodedMac}`, { name, notes, tags });
            mutate(`/devices/${encodedMac}`);
            mutate('/devices');
        } catch (e) {
            alert('Failed to update device');
        } finally {
            setSaving(false);
        }
    };

    if (deviceError || eventsError) return <div className="text-red-500">Failed to load device</div>;
    if (!device || !events) return <div className="text-slate-400">Loading device...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/devices" className="text-slate-400 hover:text-white text-sm">{'<- Back to devices'}</Link>
                    <h1 className="text-3xl font-bold text-white mt-2">{deviceTitle(device)}</h1>
                    <div className="text-slate-500 text-sm font-mono mt-1">{device.mac}</div>
                </div>
                <button
                    onClick={save}
                    disabled={saving}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
                >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Device Info</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-400">IP Address</span>
                            <span className="text-slate-200 font-mono">{device.ip_address || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Hostname</span>
                            <span className="text-slate-200">{device.hostname || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Vendor</span>
                            <span className="text-slate-200">{device.vendor || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Status</span>
                            <span className={device.is_online ? 'text-green-400' : 'text-slate-400'}>
                                {device.is_online ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">First Seen</span>
                            <span className="text-slate-200">{device.first_seen ? new Date(device.first_seen).toLocaleString() : 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Last Seen</span>
                            <span className="text-slate-200">{device.last_seen ? new Date(device.last_seen).toLocaleString() : 'N/A'}</span>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Name</label>
                            <input
                                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Tags (comma-separated)</label>
                            <input
                                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white"
                                value={tagsInput}
                                onChange={(e) => setTagsInput(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Notes</label>
                            <textarea
                                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white h-28"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Tags</h2>
                    <div className="flex flex-wrap gap-2">
                        {(device.tags || []).length === 0 ? (
                            <span className="text-slate-500 text-sm">No tags</span>
                        ) : (
                            device.tags.map((tag: string) => (
                                <span key={tag} className="px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs">
                                    {tag}
                                </span>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Recent Events</h2>
                {deviceEvents.length === 0 ? (
                    <div className="text-slate-500">No recent events</div>
                ) : (
                    <div className="space-y-3">
                        {deviceEvents.map((event: any) => (
                            <div key={event.id} className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-slate-200 font-medium">{event.type}</div>
                                    <div className="text-slate-400 text-sm">{event.message}</div>
                                </div>
                                <div className="text-xs text-slate-500">
                                    {new Date(event.timestamp).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
