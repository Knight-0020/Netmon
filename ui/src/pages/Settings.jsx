import React, { useState } from 'react'
import { api } from '../lib/api'
import { Save, Send } from 'lucide-react'

export default function Settings() {
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState({}) // Todo: fetch config

  const handleTestTelegram = async () => {
    setLoading(true)
    try {
      await api.testTelegram()
      alert('Test message sent!')
    } catch(e) {
      alert('Failed to send test message')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Telegram Notifications</h2>
          <p className="text-sm text-gray-500 mb-4">Configure alerts for new devices and internet outages.</p>
          
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
             <div className="flex-1">
               <p className="text-sm font-medium text-gray-900">Test Integration</p>
               <p className="text-xs text-gray-500">Sends a dummy message to the configured chat.</p>
             </div>
             <button 
               onClick={handleTestTelegram}
               disabled={loading}
               className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
             >
               <Send className="w-4 h-4" />
               Send Test
             </button>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100">
           <h2 className="text-lg font-semibold text-gray-900 mb-4">Network Configuration</h2>
           <div className="grid gap-4">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">LAN CIDR (Read-only)</label>
               <input disabled value="192.168.1.0/24" className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500" />
               <p className="text-xs text-gray-400 mt-1">Defined in server .env</p>
             </div>
             
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Scan Interval</label>
               <input disabled value="20s" className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500" />
             </div>
           </div>
        </div>
      </div>
    </div>
  )
}
