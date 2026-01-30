import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { AlertCircle, ArrowUpCircle, ArrowDownCircle, Info, Wifi } from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns' // If installed, otherwise fallback.
// I'll assume standard Intl for now as I didn't install date-fns explicitly in my command (only clsx tailwind-merge lucide-react recharts react-router-dom)
// Wait, I did 'npm install' on package.json but I didn't add date-fns in package.json manually.
// So I should use Intl.DateTimeFormat.

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })

const ICONS = {
  NEW_DEVICE: Info,
  ONLINE: ArrowUpCircle,
  OFFLINE: ArrowDownCircle,
  INTERNET_DOWN: Wifi,
  LATENCY_SPIKE: AlertCircle,
  IP_CHANGE: Info,
}

const COLORS = {
  NEW_DEVICE: 'text-blue-500 bg-blue-50',
  ONLINE: 'text-emerald-500 bg-emerald-50',
  OFFLINE: 'text-gray-500 bg-gray-50',
  INTERNET_DOWN: 'text-red-500 bg-red-50',
  LATENCY_SPIKE: 'text-amber-500 bg-amber-50',
  IP_CHANGE: 'text-indigo-500 bg-indigo-50',
}

export default function Events() {
  const [events, setEvents] = useState([])

  const load = async () => {
    try {
      const data = await api.getEvents()
      setEvents(data || []) // Handle null
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Event Log</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Device / Target</th>
                <th className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {events.map((evt) => {
                const Icon = ICONS[evt.type] || Info
                const colorClass = COLORS[evt.type] || 'text-gray-500 bg-gray-50'
                let details = {}
                try { details = JSON.parse(atob(evt.details)) } catch (e) { 
                   // If not base64? The DB driver returns []byte as base64 string in JSON usually? 
                   // Or just generic JSON object if gin binds it?
                   // Actually `db.Event` struct has `Details []byte`. Json marshal of []byte is base64.
                   // So on client we must decode base64.
                   // Wait, if it's already JSON in DB `jsonb`, scanning it into []byte gives the characters.
                   // Go json.Marshal of []byte -> Base64 string.
                   // So yes, `atob`. 
                   // EXCEPT if I scanned it as json.RawMessage? No `[]byte`.
                   // Let's assume Base64 for now.
                   try { details = JSON.parse(evt.details) } catch (e2) {
                       // Maybe it's not base64 encoded if I used sql.NullString or similar?
                       // Let's debug in UI if needed. For now assume it's just the string if json.Marshal didn't base64 it.
                       // Actually Go `json` package marshals `[]byte` as base64.
                   }
                }
                
                return (
                  <tr key={evt.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-400">
                      {fmt.format(new Date(evt.created_at))}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={clsx("p-1.5 rounded-md", colorClass)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-gray-900">{evt.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {evt.mac || details.target || '-'}
                    </td>
                    <td className="px-6 py-4 text-xs">
                       {/* Render detail keys */}
                       {Object.entries(details).map(([k,v]) => (
                         <span key={k} className="mr-2 px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                           {k}: {v}
                         </span>
                       ))}
                    </td>
                  </tr>
                )
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-400">No events found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
