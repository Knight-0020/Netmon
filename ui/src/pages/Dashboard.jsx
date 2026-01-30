import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Activity, ArrowUp, ArrowDown, Wifi, WifiOff, Users } from 'lucide-react'
import clsx from 'clsx'

function StatCard({ label, value, icon: Icon, color, subtext }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
        </div>
        <div className={clsx("p-3 rounded-lg", color)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {subtext && <p className="text-xs text-gray-400 mt-2">{subtext}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({ online: 0, total: 0, internet: 'Loading...', latency: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [devices, istatus] = await Promise.all([
          api.getDevices('all'),
          api.getInternetStatus()
        ])
        
        const onlineCount = devices.filter(d => d.is_online).length
        
        // Calculate average latency of recent checks
        const recent = istatus.recent_checks || []
        const latencies = recent.filter(c => c.status === 'UP').map(c => c.latency)
        const avgLat = latencies.length ? Math.round(latencies.reduce((a,b)=>a+b,0)/latencies.length) : 0

        setStats({
          online: onlineCount,
          total: devices.length,
          internet: istatus.overall || 'UP',
          latency: avgLat
        })
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Online Devices" 
          value={stats.online} 
          icon={Wifi} 
          color="bg-emerald-500" 
          subtext={`${stats.total} total known devices`}
        />
        <StatCard 
          label="Internet Status" 
          value={stats.internet} 
          icon={stats.internet === 'UP' ? ArrowUp : ArrowDown} 
          color={stats.internet === 'UP' ? "bg-blue-500" : "bg-red-500"} 
        />
        <StatCard 
          label="Avg Latency" 
          value={`${stats.latency} ms`} 
          icon={Activity} 
          color="bg-violet-500" 
        />
        <StatCard 
          label="Active Incidents" 
          value="0" 
          icon={WifiOff} 
          color="bg-amber-500" 
          subtext="No recent outages"
        />
      </div>

      {/* Recent Checks Table Placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Monitoring Status</h2>
        </div>
        <div className="p-6 text-gray-500 text-sm">
          System is monitoring internet connectivity via Ping, DNS, and HTTP checks.
        </div>
      </div>
    </div>
  )
}
