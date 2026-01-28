"use client";

import useSWR from 'swr';
import { fetcher } from '@/lib/api';

export default function InternetPage() {
    const { data: internet, error } = useSWR('/internet/status', fetcher, { refreshInterval: 5000 });

    if (error) return <div className="text-red-500">Failed to load internet status</div>;
    if (!internet) return <div className="text-slate-400">Loading...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white">Internet Health</h1>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Live Measurements</h2>
                {/* Add Chart here if we had a library, for now just list */}
                <div className="space-y-2">
                    {internet.recent_checks.map((check: any) => (
                        <div key={check.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                            <div>
                                <span className="text-slate-200 font-mono">{check.target}</span>
                                <span className="text-xs text-slate-500 ml-2">({check.check_type})</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`${check.status === 'UP' ? 'text-green-500' : 'text-red-500'} font-bold`}>
                                    {check.status}
                                </span>
                                <span className="text-slate-400 w-16 text-right">
                                    {check.latency_ms ? `${Math.round(check.latency_ms)}ms` : '-'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Incident HIstory</h2>
                {internet.incidents.length === 0 ? (
                    <p className="text-slate-500">No recent incidents recorded.</p>
                ) : (
                    <div className="space-y-4">
                        {internet.incidents.map((inc: any) => (
                            <div key={inc.id} className="bg-slate-900/50 p-4 rounded-lg border-l-4 border-red-500">
                                <div className="flex justify-between">
                                    <h3 className="text-white font-bold">{inc.type}</h3>
                                    <span className="text-slate-400 text-sm">
                                        {new Date(inc.start_time).toLocaleString()} -
                                        {inc.end_time ? new Date(inc.end_time).toLocaleString() : 'Ongoing'}
                                    </span>
                                </div>
                                <p className="text-slate-300 mt-2">{inc.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
