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
    if (result?.message) setMessage(result.message)
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold">FuelTracker</h1>

        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setMode('password')}
            className={mode === 'password' ? 'font-semibold underline' : 'text-muted-foreground'}
          >
            Password
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            onClick={() => setMode('magic-link')}
            className={mode === 'magic-link' ? 'font-semibold underline' : 'text-muted-foreground'}
          >
            Magic link
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          {mode === 'password' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-black py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Signing in…' : mode === 'password' ? 'Sign in' : 'Send magic link'}
          </button>
        </form>
      </div>
    </main>
  )
}
