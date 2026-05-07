'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const links = [
  { href: '/dashboard',             label: 'Home' },
  { href: '/dashboard/reports',     label: 'Reports' },
  { href: '/dashboard/tank-trends', label: 'Tank trends' },
  { href: '/dashboard/history',     label: 'Shift history' },
  { href: '/dashboard/config',      label: 'Config' },
  { href: '/dashboard/users',       label: 'Users' },
]

function isActive(href: string, pathname: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(href)
}

export function DashboardNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* ── Mobile: fixed top bar ─────────────────────────────────────────── */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 h-14 z-30 flex items-center px-4"
        style={{ background: '#141B2D', borderBottom: '1px solid #2A3656' }}
      >
        <button
          onClick={() => setOpen(true)}
          className="text-gray-400 hover:text-white p-1 -ml-1"
          aria-label="Open menu"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold text-white tracking-wide">
          FuelTracker
        </span>
      </div>

      {/* ── Mobile: backdrop ──────────────────────────────────────────────── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile: slide-out drawer ──────────────────────────────────────── */}
      <div
        className={`md:hidden fixed top-0 left-0 h-full w-60 z-50 flex flex-col transition-transform duration-200 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#141B2D' }}
      >
        <div
          className="flex items-center justify-between px-4 h-14 shrink-0"
          style={{ borderBottom: '1px solid #2A3656' }}
        >
          <span className="text-sm font-semibold text-white tracking-wide">FuelTracker</span>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-white p-1 -mr-1"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(link.href, pathname)
                  ? 'bg-white/10 text-amber-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Desktop: horizontal nav bar ───────────────────────────────────── */}
      <div
        className="hidden md:block"
        style={{ background: '#141B2D', borderBottom: '1px solid #2A3656' }}
      >
        <div className="max-w-4xl mx-auto px-4">
          <nav className="flex items-center gap-1 py-1.5">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href, pathname)
                    ? 'bg-white/10 text-amber-400'
                    : 'text-gray-500 hover:text-white hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  )
}
