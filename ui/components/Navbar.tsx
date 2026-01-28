"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { LayoutDashboard, Network, Calendar, Activity } from 'lucide-react';

const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Devices', href: '/devices', icon: Network },
    { name: 'Events', href: '/events', icon: Calendar },
    { name: 'Internet', href: '/internet', icon: Activity },
];

export default function Navbar() {
    const pathname = usePathname();

    return (
        <nav className="bg-slate-900 border-b border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <span className="text-blue-500 font-bold text-xl tracking-wider">NETMON</span>
                        </div>
                        <div className="hidden md:block">
                            <div className="ml-10 flex items-baseline space-x-4">
                                {navItems.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            className={clsx(
                                                pathname === item.href
                                                    ? 'bg-slate-800 text-white'
                                                    : 'text-slate-300 hover:bg-slate-700 hover:text-white',
                                                'px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors'
                                            )}
                                        >
                                            <Icon size={18} />
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
