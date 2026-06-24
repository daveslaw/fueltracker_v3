'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { signInWithPassword, resetPassword } from './actions'
import { createClient } from '@/lib/supabase/client'
import { getStationId } from '@/lib/station-device'
import { UserPicker } from '@/components/UserPicker'

type AuthMode = 'password' | 'forgot-password'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const inviteExpiredError =
    searchParams.get('error') === 'invite-expired'
      ? 'This invite link has expired or already been used. Ask an owner to send a new invite.'
      : null

  const [mode, setMode] = useState<AuthMode>('password')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [stationId, setStationId] = useState<string | null | undefined>(undefined)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  useEffect(() => {
    setStationId(getStationId())
  }, [])

  // Handle implicit-flow invite tokens delivered as URL hash fragments.
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('type=invite')) return
    const params = new URLSearchParams(hash.slice(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (!access_token || !refresh_token) return

    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (!error) window.location.replace('/set-password')
      })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setPending(true)

    const formData = new FormData(e.currentTarget)
    const result =
      mode === 'password'
        ? await signInWithPassword(formData)
        : await resetPassword(formData)

    setPending(false)
    if (result && 'error' in result) setError(result.error)
    if (result && 'message' in result) setMessage(result.message)
  }

  // Show nothing while we detect the station binding
  if (stationId === undefined) {
    return (
      <main className="relative flex min-h-screen items-center justify-center p-4 bg-gray-50" />
    )
  }

  // Station binding present → User Picker (or owner password form, toggled)
  if (stationId && !showPasswordForm) {
    return (
      <main className="relative flex min-h-screen items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="mb-8">
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
                style={{ color: '#D08700' }}
              >
                FuelTracker
              </span>
            </div>
            <h1 className="text-3xl font-bold leading-none tracking-wide text-gray-900">
              Who&apos;s working?
            </h1>
          </div>
          <UserPicker stationId={stationId} />
          <button
            type="button"
            onClick={() => setShowPasswordForm(true)}
            className="mt-6 w-full text-center text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            Owner login
          </button>
        </div>
      </main>
    )
  }

  // No station binding → standard password login
  return (
    <main className="relative flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
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
              style={{ color: '#D08700', letterSpacing: '0.22em' }}
            >
              FuelTracker
            </span>
          </div>
          <h1
            className="text-[2.6rem] font-bold leading-none tracking-wide text-gray-900"
            style={{ fontFamily: 'var(--font-heading), sans-serif' }}
          >
            {mode === 'forgot-password' ? 'Reset Password' : 'Station Control'}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {mode === 'forgot-password'
              ? "Enter your email and we'll send a reset link."
              : 'Sign in to your operator dashboard'}
          </p>
        </div>

        {/* Invite-expired error banner */}
        {inviteExpiredError && (
          <div className="rounded-lg px-4 py-2.5 text-sm mb-6 bg-red-50 border border-red-200 text-red-700">
            {inviteExpiredError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block mb-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg px-4 py-2.5 text-sm bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          {mode === 'password' && (
            <div>
              <label
                htmlFor="password"
                className="block mb-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg px-4 py-2.5 text-sm bg-white border border-gray-300 text-gray-900 focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg px-4 py-2.5 text-sm bg-red-50 border border-red-200 text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-lg px-4 py-2.5 text-sm bg-green-50 border border-green-200 text-green-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg py-2.5 text-sm font-bold tracking-wide transition-opacity disabled:opacity-50 disabled:cursor-default"
            style={{ background: '#F59F00', color: '#1a1200' }}
          >
            {pending
              ? mode === 'forgot-password' ? 'Sending…' : 'Signing in…'
              : mode === 'password' ? 'Sign in' : 'Send reset link'}
          </button>

          {mode === 'password' && !message && (
            <button
              type="button"
              onClick={() => { setMode('forgot-password'); setError(null); setMessage(null) }}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600"
            >
              Forgot password?
            </button>
          )}

          {mode === 'forgot-password' && (
            <button
              type="button"
              onClick={() => { setMode('password'); setError(null); setMessage(null) }}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600"
            >
              Back to sign in
            </button>
          )}

          {stationId && (
            <button
              type="button"
              onClick={() => setShowPasswordForm(false)}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Back to staff picker
            </button>
          )}
        </form>
      </div>
    </main>
  )
}
