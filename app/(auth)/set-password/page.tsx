'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setPassword } from './actions'

export default function SetPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) window.location.replace('/login')
        else setChecking(false)
      })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const result = await setPassword(new FormData(e.currentTarget))
    setPending(false)
    if (result?.error) setError(result.error)
  }

  if (checking) return null

  return (
    <main
      className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden"
      style={{ background: '#0B0F1A' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 45% at 50% -5%, rgba(245,159,0,0.09) 0%, transparent 65%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(226,232,240,0.03) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(226,232,240,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-4">
            <div
              style={{
                width: 10,
                height: 10,
                background: '#F59F00',
                borderRadius: 2,
                transform: 'rotate(45deg)',
                flexShrink: 0,
              }}
            />
            <span
              className="text-xs font-semibold tracking-[0.22em] uppercase"
              style={{ color: '#F59F00' }}
            >
              FuelTracker
            </span>
          </div>
          <h1
            className="text-[2.6rem] font-bold leading-none tracking-wide"
            style={{ color: '#E8EDF4', fontFamily: 'var(--font-heading), sans-serif' }}
          >
            Set Password
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#7B8EA8' }}>
            Choose a password to secure your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block mb-1.5 text-xs font-semibold uppercase tracking-widest"
              style={{ color: '#56698A' }}
            >
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg px-4 py-2.5 text-sm"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid #2A3656',
                color: '#E2E8F0',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="confirm"
              className="block mb-1.5 text-xs font-semibold uppercase tracking-widest"
              style={{ color: '#56698A' }}
            >
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg px-4 py-2.5 text-sm"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid #2A3656',
                color: '#E2E8F0',
              }}
            />
          </div>

          {error && (
            <div
              className="rounded-lg px-4 py-2.5 text-sm"
              style={{
                background: 'rgba(244,63,94,0.10)',
                border: '1px solid rgba(244,63,94,0.25)',
                color: '#FB7185',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg py-2.5 text-sm font-bold tracking-wide transition-opacity disabled:opacity-50 disabled:cursor-default"
            style={{ background: '#F59F00', color: '#0B0F1A' }}
          >
            {pending ? 'Saving…' : 'Set password'}
          </button>
        </form>
      </div>
    </main>
  )
}
