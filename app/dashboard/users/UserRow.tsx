'use client'

import { useState } from 'react'
import { updateUserProfile, setUserActive } from './actions'
import { INVITABLE_ROLES, type UserStatus } from '@/lib/user-management'

type Station = { id: string; name: string }
type User = {
  id: string
  email: string
  role: string
  station_id: string | null
  station_name: string
  last_sign_in_at: string | null
  status: UserStatus
  is_active: boolean
}

const STATUS_BADGE: Record<UserStatus, string> = {
  active:   'bg-green-100 text-green-800',
  pending:  'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-500',
}

export function UserRow({ user, stations }: { user: User; stations: Station[] }) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const result = await updateUserProfile(user.id, new FormData(e.currentTarget))
    setPending(false)
    if ('error' in result) { setError(result.error); return }
    setEditing(false)
  }

  async function toggleActive() {
    setPending(true)
    await setUserActive(user.id, !user.is_active)
    setPending(false)
  }

  const lastLogin = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString('en-ZA')
    : '—'

  return (
    <>
      <tr className="border-b">
        <td className="py-2 pr-4 font-mono text-xs">{user.email}</td>
        <td className="py-2 pr-4 capitalize">{user.role}</td>
        <td className="py-2 pr-4">{user.station_name}</td>
        <td className="py-2 pr-4 text-gray-500">{lastLogin}</td>
        <td className="py-2 pr-4">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[user.status]}`}>
            {user.status}
          </span>
        </td>
        <td className="py-2 flex gap-2">
          <button onClick={() => setEditing(!editing)}
            className="text-xs text-blue-600 hover:underline">
            Edit
          </button>
          <button onClick={toggleActive} disabled={pending}
            className="text-xs text-gray-500 hover:underline disabled:opacity-50">
            {user.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
        </td>
      </tr>
      {editing && (
        <tr className="bg-gray-50">
          <td colSpan={6} className="py-3 px-4">
            <form onSubmit={handleUpdate} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium mb-1">Role</label>
                <select name="role" defaultValue={user.role}
                  className="rounded border px-2 py-1 text-sm">
                  {INVITABLE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Station</label>
                <select name="station_id" defaultValue={user.station_id ?? ''}
                  className="rounded border px-2 py-1 text-sm">
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={pending}
                className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                {pending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="text-xs text-gray-500 hover:underline">
                Cancel
              </button>
              {error && <p className="w-full text-xs text-red-600">{error}</p>}
            </form>
          </td>
        </tr>
      )}
    </>
  )
}
