"use client";

import useSWR, { mutate } from 'swr';
import { fetcher, patcher } from '@/lib/api';
import { useState } from 'react';
import { Search, Edit2, Save, X, Server, Wifi } from 'lucide-react';
import Link from 'next/link';

export default function DevicesPage() {
    const { data: devices, error } = useSWR('/devices', fetcher);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    if (error) return <div className="text-red-500">Failed to load devices</div>;
    if (!devices) return <div className="text-slate-400">Loading devices...</div>;

    const filtered = devices.filter((d: any) => {
        const matchesSearch =
            d.mac.toLowerCase().includes(search.toLowerCase()) ||
            (d.hostname && d.hostname.toLowerCase().includes(search.toLowerCase())) ||
            (d.name && d.name.toLowerCase().includes(search.toLowerCase())) ||
            (d.ip_address && d.ip_address.includes(search));

        if (filter === 'ONLINE') return matchesSearch && d.is_online;
        if (filter === 'OFFLINE') return matchesSearch && !d.is_online;
        return matchesSearch;
    }).sort((a: any, b: any) => {
        if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
        const aTime = a.last_seen ? new Date(a.last_seen).getTime() : 0;
        const bTime = b.last_seen ? new Date(b.last_seen).getTime() : 0;
        return bTime - aTime;
    });

    const startEdit = (d: any) => {
        setEditingId(d.mac);
        setEditName(d.name || '');
    };

    const saveEdit = async (mac: string) => {
        try {
            await patcher(`/devices/${mac}`, { name: editName });
            setEditingId(null);
            mutate('/devices');
        } catch (e) {
            alert('Failed to update');
        }
    };

    const deviceTitle = (device: any) => {
        const name = device.name?.trim();
        if (name) return name;
        const host = device.hostname?.trim();
        if (host) return host;
        const vendor = device.vendor?.trim();
        return vendor || 'Unknown Device';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold text-white">Devices</h1>

                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search MAC, IP, Name..."
                            className="bg-slate-800 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="bg-slate-800 border border-slate-700 text-white px-4 py-2 rounded-lg focus:outline-none"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                    >
                        <option value="ALL">All Status</option>
                        <option value="ONLINE">Online</option>
                        <option value="OFFLINE">Offline</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((device: any) => (
                    <div key={device.mac} className={`group bg-slate-800 rounded-xl border ${device.is_online ? 'border-green-500/30' : 'border-slate-700'} p-6 shadow-lg transition-all hover:border-slate-600`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${device.is_online ? 'bg-green-500/20 text-green-500' : 'bg-slate-700 text-slate-500'}`}>
                                    {device.hostname?.includes('pi') || device.vendor?.includes('Raspberry') ? <Server size={20} /> : <Wifi size={20} />}
                                </div>
                                <div>
                                    {editingId === device.mac ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                            />
                                            <button onClick={() => saveEdit(device.mac)} className="text-green-500"><Save size={16} /></button>
                                            <button onClick={() => setEditingId(null)} className="text-red-500"><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <h3 className="text-white font-semibold flex items-center gap-2">
                                            <Link className="hover:underline" href={`/devices/${encodeURIComponent(device.mac)}`}>
                                                {deviceTitle(device)}
                                            </Link>
                                            <button onClick={() => startEdit(device)} className="text-slate-500 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Edit2 size={12} />
                                            </button>
                                        </h3>
                                    )}
                                    <p className="text-xs text-slate-500 font-mono mt-1">{device.mac}</p>
                                </div>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${device.is_online ? 'bg-green-500/10 text-green-500' : 'bg-slate-700 text-slate-400'}`}>
                                {device.is_online ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>

                        <div className="space-y-2 text-sm text-slate-400">
                            <div className="flex justify-between">
                                <span>IP Address:</span>
                                <span className="text-slate-200 font-mono">{device.ip_address || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Vendor:</span>
                                <span className="text-slate-200">{device.vendor || 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Last Seen:</span>
                                <span className="text-slate-200">{device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
