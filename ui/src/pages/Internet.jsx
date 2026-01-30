import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowUp, ArrowDown } from 'lucide-react'

export default function Internet() {
  const [status, setStatus] = useState(null)
  
  const load = async () => {
    try {
      const data = await api.getInternetStatus()
      setStatus(data)
    } catch(e) { console.error(e) }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  // Mock data for chart if not available api endpint
  const data = [
    { name: '10:00', latency: 24 },
    { name: '10:05', latency: 22 },
    { name: '10:10', latency: 25 },
    { name: '10:15', latency: 28 },
    { name: '10:20', latency: 23 },
    { name: '10:25', latency: 24 },
    { name: '10:30', latency: 25 },
  ]

  if (!status) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Internet Health</h1>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold ${status.overall === 'UP' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {status.overall === 'UP' ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
          {status.overall}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
           <h3 className="font-semibold text-gray-900 mb-6">Latency History (24h)</h3>
           <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={data}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                 <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                 <Tooltip />
                 <Line type="monotone" dataKey="latency" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{r: 6}} />
               </LineChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
           <h3 className="font-semibold text-gray-900 mb-4">Recent Checks</h3>
           <div className="space-y-4">
             {status.recent_checks && status.recent_checks.map((c, i) => (
               <div key={i} className="flex justify-between items-center text-sm">
                 <div className="flex flex-col">
                   <span className="font-medium text-gray-900">{c.target}</span>
                   <span className="text-xs text-gray-400 capitalize">{c.type}</span>
                 </div>
                 <div className="flex items-center gap-3">
                   <span className="font-mono text-gray-500 text-xs">{c.latency}ms</span>
                   <span className={`w-2 h-2 rounded-full ${c.status==='UP' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  )
}
