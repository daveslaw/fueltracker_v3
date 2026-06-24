'use client'

import { useState, useEffect } from 'react'
import { createStationUser } from './actions'
import { INVITABLE_ROLES, generateUsername } from '@/lib/user-management'

type Station = { id: string; name: string }

export function CreateStationUserForm({ stations, existingUsernames }: { stations: Station[]; existingUsernames: string[] }) {
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameEdited, setUsernameEdited] = useState(false)

  useEffect(() => {
    if (!usernameEdited) {
      setUsername(generateUsername(fullName, existingUsernames))
    }
  }, [fullName, usernameEdited, existingUsernames])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setPending(true)
    const fd = new FormData(e.currentTarget)
    fd.set('username', username)
    const result = await createStationUser(fd)
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    setMessage('Staff member created.')
    setFullName('')
    setUsername('')
    setUsernameEdited(false)
    ;(e.target as HTMLFormElement).reset()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-sm font-medium mb-1">Full name</label>
        <input
          name="full_name"
          type="text"
          required
          placeholder="Maria Sithole"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded border px-3 py-2 text-sm w-44"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Username</label>
        <input
          name="username"
          type="text"
          required
          value={username}
          onChange={(e) => { setUsername(e.target.value); setUsernameEdited(true) }}
          className="rounded border px-3 py-2 text-sm w-40 font-mono"
        />
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
      <div>
        <label className="block text-sm font-medium mb-1">PIN</label>
        <input name="pin" type="password" inputMode="numeric" maxLength={4}
          placeholder="4 digits" required
          className="rounded border px-3 py-2 text-sm w-24" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Confirm PIN</label>
        <input name="pin_confirm" type="password" inputMode="numeric" maxLength={4}
          placeholder="4 digits" required
          className="rounded border px-3 py-2 text-sm w-24" />
      </div>
      <button type="submit" disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {pending ? 'Creating…' : 'Create staff member'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
      {message && <p className="w-full text-sm text-green-600">{message}</p>}
    </form>
  )
}
