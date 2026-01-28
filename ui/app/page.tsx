"use client";

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { Activity, AlertTriangle, CheckCircle, Smartphone } from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
    const { data: internet, error: internetError } = useSWR('/internet/status', fetcher, { refreshInterval: 5000 });
    const { data: devices, error: devicesError } = useSWR('/devices', fetcher, { refreshInterval: 10000 });

    if (internetError || devicesError) return <div className="text-red-500">Failed to load data</div>;
    if (!internet || !devices) return <div className="text-slate-400">Loading...</div>;

    const onlineDevices = devices.filter((d: any) => d.is_online).length;
    const recentChecks = internet.recent_checks.slice(0, 3);
    const activeIncidents = internet.incidents.filter((i: any) => !i.end_time);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Online Devices */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Online Devices</p>
                            <h3 className="text-4xl font-bold text-blue-500 mt-2">{onlineDevices}</h3>
                        </div>
                        <div className="bg-slate-700 p-3 rounded-lg">
                            <Smartphone className="text-blue-400" size={24} />
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-slate-500">
                        Total: {devices.length} devices discovered
                    </div>
                </div>

                {/* Internet Status */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Internet Health</p>
                            <div className="flex items-center gap-2 mt-2">
                                {recentChecks[0]?.status === 'UP' ? (
                                    <span className="text-green-500 text-2xl font-bold flex items-center gap-2">
                                        <CheckCircle size={24} /> UP
                                    </span>
                                ) : (
                                    <span className="text-red-500 text-2xl font-bold flex items-center gap-2">
                                        <AlertTriangle size={24} /> DOWN
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="bg-slate-700 p-3 rounded-lg">
                            <Activity className="text-green-400" size={24} />
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-slate-500">
                        Latency: {recentChecks[0]?.latency_ms ? Math.round(recentChecks[0].latency_ms) : 'N/A'} ms
                    </div>
                </div>

                {/* Incidents */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm font-medium">Active Incidents</p>
                            <h3 className="text-4xl font-bold text-amber-500 mt-2">{activeIncidents.length}</h3>
                        </div>
                        <div className="bg-slate-700 p-3 rounded-lg">
                            <AlertTriangle className="text-amber-400" size={24} />
                        </div>
                    </div>
                    <div className="mt-4 text-sm text-slate-500">
                        {activeIncidents.length > 0 ? 'Attention Needed' : 'All systems normal'}
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <h2 className="text-xl font-bold text-white mt-8 mb-4">Recent Activity</h2>
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900/50 text-slate-200">
                        <tr>
                            <th className="p-4">Time</th>
                            <th className="p-4">Target</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Latency</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {internet.recent_checks.map((check: any) => (
                            <tr key={check.id} className="hover:bg-slate-700/50">
                                <td className="p-4">{new Date(check.timestamp).toLocaleTimeString()}</td>
                                <td className="p-4 font-mono text-slate-300">{check.target}</td>
                                <td className="p-4">{check.check_type}</td>
                                <td className="p-4">
                                    {check.status === 'UP' ? (
                                        <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded text-xs font-bold">UP</span>
                                    ) : (
                                        <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded text-xs font-bold">DOWN</span>
                                    )}
                                </td>
                                <td className="p-4">{check.latency_ms ? `${Math.round(check.latency_ms)}ms` : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
