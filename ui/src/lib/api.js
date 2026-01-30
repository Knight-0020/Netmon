// Mock Data
const MOCK_DEVICES = [
  { mac: '00:11:22:33:44:55', ip: '192.168.1.10', hostname: 'MyPhone', vendor: 'Apple', is_online: true, last_seen: new Date().toISOString() },
  { mac: '66:77:88:99:AA:BB', ip: '192.168.1.20', hostname: 'Laptop', vendor: 'Dell', is_online: true, last_seen: new Date().toISOString() },
  { mac: 'CC:DD:EE:FF:00:11', ip: '192.168.1.50', hostname: '', vendor: 'Espressif', is_online: false, last_seen: new Date(Date.now() - 86400000).toISOString() },
]
const MOCK_EVENTS = [
  { id: 1, type: 'NEW_DEVICE', mac: '00:11:22:33:44:55', details: '{}', created_at: new Date().toISOString() },
  { id: 2, type: 'INTERNET_DOWN', mac: '', details: '{"target":"8.8.8.8"}', created_at: new Date(Date.now() - 3600000).toISOString() },
]
const MOCK_INTERNET = {
  overall: 'UP',
  recent_checks: [
    { type: 'ping', target: '8.8.8.8', latency: 24, status: 'UP', time: new Date().toISOString() },
    { type: 'http', target: 'google.com', latency: 156, status: 'UP', time: new Date().toISOString() }
  ]
}

export async function fetcher(url, options = {}) {
  try {
    const res = await fetch(url, options)
    if (!res.ok) throw new Error()
    return res.json()
  } catch (e) {
    console.warn('API unavailable, returning mock data')
    if (url.includes('/devices')) return MOCK_DEVICES
    if (url.includes('/events')) return MOCK_EVENTS
    if (url.includes('/internet')) return MOCK_INTERNET
    if (url.includes('test-telegram')) return {}
    return []
  }
}

export const api = {
  getDevices: (status = 'all', search = '') => 
    fetcher(`/api/devices?status=${status}&search=${encodeURIComponent(search)}`),
  
  updateDevice: (mac, data) => 
    fetcher(`/api/devices/${mac}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getEvents: () => fetcher('/api/events'),
  
  getInternetStatus: () => fetcher('/api/internet/status'),
  
  testTelegram: () => fetcher('/api/settings/test-telegram', { method: 'POST' })
}
