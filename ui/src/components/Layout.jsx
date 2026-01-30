import React from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, MonitorSmartphone, History, Globe, Settings, Network } from 'lucide-react'
import clsx from 'clsx'

const NavItem = ({ to, icon: Icon, children }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      clsx(
        'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors',
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-700 hover:bg-gray-100'
      )
    }
  >
    <Icon className="w-5 h-5" />
    {children}
  </NavLink>
)

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 flex items-center gap-2 border-b border-gray-100">
          <Network className="w-8 h-8 text-blue-600" />
          <span className="text-xl font-bold text-gray-900">NetMon v3</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavItem to="/" icon={LayoutDashboard}>Dashboard</NavItem>
          <NavItem to="/devices" icon={MonitorSmartphone}>Devices</NavItem>
          <NavItem to="/events" icon={History}>Events</NavItem>
          <NavItem to="/internet" icon={Globe}>Internet</NavItem>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <NavItem to="/settings" icon={Settings}>Settings</NavItem>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
