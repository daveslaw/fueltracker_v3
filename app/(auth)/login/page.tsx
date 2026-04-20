'use client'

import { useState } from 'react'
import { signInWithPassword, signInWithMagicLink } from './actions'

type AuthMode = 'password' | 'magic-link'

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('password')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setPending(true)

    const formData = new FormData(e.currentTarget)
    const result =
      mode === 'password'
        ? await signInWithPassword(formData)
        : await signInWithMagicLink(formData)

    setPending(false)
    if (result?.error) setError(result.error)
    if (result && 'message' in result) setMessage(result.message)
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center p-4 overflow-hidden"
      style={{ background: '#0B0F1A' }}
    >
      {/* Canopy glow — ambient light from above */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 45% at 50% -5%, rgba(245,159,0,0.09) 0%, transparent 65%)',
        }}
      />

      {/* Subtle grid — operations panel texture */}
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
        {/* Brand mark */}
        <div className="mb-10">
          <div className="flex items-center gap-2.5 mb-4">
            {/* Rotated diamond — fuel rhombus */}
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
              style={{ color: '#F59F00', letterSpacing: '0.22em' }}
            >
              FuelTracker
            </span>
          </div>
          <h1
            className="text-[2.6rem] font-bold leading-none tracking-wide"
            style={{ color: '#E8EDF4', fontFamily: 'var(--font-heading), sans-serif' }}
          >
            Station Control
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#7B8EA8' }}>
            Sign in to your operator dashboard
          </p>
        </div>

        {/* Mode selector — pill toggle */}
        <div
          className="flex gap-1 mb-6 rounded-lg p-1"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid #2A3656',
          }}
        >
          {(['password', 'magic-link'] as AuthMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="flex-1 rounded py-1.5 text-xs font-semibold transition-all duration-150"
              style={
                mode === m
                  ? { background: '#F59F00', color: '#0B0F1A' }
                  : { color: '#7B8EA8' }
              }
            >
              {m === 'password' ? 'Password' : 'Magic link'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block mb-1.5 text-xs font-semibold uppercase tracking-widest"
              style={{ color: '#56698A' }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg px-4 py-2.5 text-sm transition-colors"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid #2A3656',
                color: '#E2E8F0',
              }}
            />
          </div>

          {mode === 'password' && (
            <div>
              <label
                htmlFor="password"
                className="block mb-1.5 text-xs font-semibold uppercase tracking-widest"
                style={{ color: '#56698A' }}
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg px-4 py-2.5 text-sm"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid #2A3656',
                  color: '#E2E8F0',
                }}
              />
            </div>
          )}

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

          {message && (
            <div
              className="rounded-lg px-4 py-2.5 text-sm"
              style={{
                background: 'rgba(16,185,129,0.10)',
                border: '1px solid rgba(16,185,129,0.25)',
                color: '#34D399',
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg py-2.5 text-sm font-bold tracking-wide transition-opacity disabled:opacity-50 disabled:cursor-default"
            style={{ background: '#F59F00', color: '#0B0F1A' }}
          >
            {pending
              ? 'Signing in…'
              : mode === 'password'
              ? 'Sign in'
              : 'Send magic link'}
          </button>
        </form>
      </div>
    </main>
  )
}
