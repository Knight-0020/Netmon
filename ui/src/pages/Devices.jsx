import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Search, Monitor, Laptop, Smartphone, Edit2, CheckCircle2, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { formatDistanceToNow } from 'date-fns' // Oops, need to install date-fns? Or just use intl.
// I'll stick to Intl.RelativeTimeFormat or simple logic for MVP to avoid extra installs if possible.
// Or just "npm install date-fns" quickly. It's standard.
// For now, simple formatter.

function timeAgo(dateStr) {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const diff = (new Date() - date) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
  return `${Math.floor(diff/86400)}d ago`
}

export default function Devices() {
  const [devices, setDevices] = useState([])
  const [filter, setFilter] = useState('all') // all, online, offline
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // mac of editing device

  const load = async () => {
    try {
      const data = await api.getDevices(filter, search)
      setDevices(data)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [filter, search])

  // Simple Edit Form
  const handleEdit = (mac) => {
    setEditing(mac)
  }
  
  const handleSave = async (mac, label, notes) => {
    await api.updateDevice(mac, { user_label: label, notes, tags: [] })
    setEditing(null)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Devices ({devices.length})</h1>
        
        <div className="flex gap-2">
           <select 
             className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
             value={filter}
             onChange={e => setFilter(e.target.value)}
           >
             <option value="all">All Status</option>
             <option value="online">Online</option>
             <option value="offline">Offline</option>
           </select>
           <div className="relative">
             <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
             <input 
               type="text" 
               placeholder="Search..." 
               className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {devices.map(dev => (
          <div key={dev.mac} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3 group">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className={clsx("p-2 rounded-lg", dev.is_online ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400")}>
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                   {editing === dev.mac ? (
                     <EditForm dev={dev} onSave={handleSave} onCancel={() => setEditing(null)} />
                   ) : (
                     <div onClick={() => handleEdit(dev.mac)} className="cursor-pointer hover:text-blue-600 transition-colors">
                        <h3 className="font-semibold text-gray-900 leading-tight">
                          {dev.user_label || dev.hostname || "Unknown Device"}
                        </h3>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{dev.ip || "No IP"}</p>
                     </div>
                   )}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className={clsx("text-xs px-2 py-1 rounded-full font-medium", dev.is_online ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600")}>
                  {dev.is_online ? "Online" : "Offline"}
                </span>
              </div>
            </div>
            
            <div className="border-t border-gray-50 pt-3 mt-auto">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{dev.vendor || "Unknown Vendor"}</span>
                <span>{dev.is_online ? "Active now" : `Last seen ${timeAgo(dev.last_seen)}`}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span className="font-mono">{dev.mac}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EditForm({ dev, onSave, onCancel }) {
  const [label, setLabel] = useState(dev.user_label || '')
  const [notes, setNotes] = useState(dev.notes || '')
  
  return (
    <div className="flex flex-col gap-2 min-w-[200px]" onClick={e => e.stopPropagation()}>
      <input autoFocus className="border rounded px-2 py-1 text-sm outline-none ring-2 ring-blue-100" value={label} onChange={e => setLabel(e.target.value)} placeholder="Friendly Name" />
      <input className="border rounded px-2 py-1 text-xs outline-none focus:border-blue-300" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." />
      <div className="flex gap-2 mt-1">
        <button onClick={() => onSave(dev.mac, label, notes)} className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700">Save</button>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 text-xs px-1">Cancel</button>
      </div>
    </div>
  )
}
