'use client'

import { useState } from 'react'
import { inviteUser } from './actions'
import { INVITABLE_ROLES } from '@/lib/user-management'

type Station = { id: string; name: string }

export function InviteForm({ stations }: { stations: Station[] }) {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setPending(true)
    const result = await inviteUser(new FormData(e.currentTarget))
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    setMessage('Invite sent.')
    ;(e.target as HTMLFormElement).reset()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input name="email" type="email" required placeholder="user@example.com"
          className="rounded border px-3 py-2 text-sm w-56" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Role</label>
        <select name="role" className="rounded border px-3 py-2 text-sm">
          <option value="">Select…</option>
          {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Station</label>
        <select name="station_id" className="rounded border px-3 py-2 text-sm">
          <option value="">Select…</option>
          {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <button type="submit" disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? 'Sending…' : 'Send invite'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
      {message && <p className="w-full text-sm text-green-600">{message}</p>}
    </form>
  )
}
