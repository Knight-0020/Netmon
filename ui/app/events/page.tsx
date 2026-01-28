"use client";

import useSWR from 'swr';
import { fetcher } from '@/lib/api';

export default function EventsPage() {
    const { data: events, error } = useSWR('/events?limit=100', fetcher, { refreshInterval: 5000 });

    if (error) return <div className="text-red-500">Failed to load events</div>;
    if (!events) return <div className="text-slate-400">Loading events...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white">Event Log</h1>

            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-slate-900/50 text-slate-200">
                            <tr>
                                <th className="p-4 w-48">Time</th>
                                <th className="p-4 w-32">Type</th>
                                <th className="p-4">Message</th>
                                <th className="p-4 w-40">Device</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {events.map((event: any) => (
                                <tr key={event.id} className="hover:bg-slate-700/50 transition-colors">
                                    <td className="p-4 whitespace-nowrap">{new Date(event.timestamp).toLocaleString()}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold 
                                ${event.type === 'NEW_DEVICE' ? 'bg-blue-500/10 text-blue-500' : ''}
                                ${event.type === 'ONLINE' ? 'bg-green-500/10 text-green-500' : ''}
                                ${event.type === 'OFFLINE' ? 'bg-red-500/10 text-red-500' : ''}
                                ${event.type === 'IP_CHANGED' ? 'bg-amber-500/10 text-amber-500' : ''}
                            `}>
                                            {event.type}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-300">{event.message}</td>
                                    <td className="p-4 font-mono text-xs">{event.device_mac || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
